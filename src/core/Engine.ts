/**
 * 引擎：渲染器、主循环、更新回调。
 *
 * 渲染管线（两步）：
 *   1. 场景 → 离屏 RenderTarget（内部分辨率，线性色彩空间；高清模式带 MSAA）
 *   2. RenderTarget → 画布（一个全屏三角形，输出时转 sRGB）
 *
 * 画布的后备缓冲始终等于它在屏幕上占的**物理像素**（CSS 尺寸 × devicePixelRatio），浏览器不再做任何拉伸。
 * - 像素风：内部分辨率 = 物理像素 / 整数倍 scale，第 2 步用最近邻采样放大，每个像素块严格是 scale×scale。
 * - 高清：内部分辨率 = 物理像素（或按画质档位封顶），第 2 步 1:1 拷贝或双线性放大。
 * 分辨率怎么算见 src/render/quality.ts 的 computeView()。
 *
 * 以后要做调色板量化 / 抖动 / 泛光等后期效果，在第 2 步的着色器里加，或在两步之间插入 pass。
 */
import * as THREE from 'three';
import { Input } from './Input';
import { bus } from './events';
import { getSettings } from './settings';
import { computeView, sameView, type RenderView } from '@/render/quality';
import { setOutlineWidth } from '@/render/toon';

export type Updater = (dt: number, time: number) => void;

export class Engine {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(55, 1, 0.1, 400);
  readonly input: Input;
  private updaters = new Set<Updater>();
  private clock = new THREE.Clock();
  private time = 0;
  private started = false;

  private currentView: RenderView | null = null;
  private target: THREE.WebGLRenderTarget | null = null;
  private readonly targetType: THREE.TextureDataType;
  private readonly blitMaterial: THREE.ShaderMaterial;
  private readonly blitScene = new THREE.Scene();
  private readonly blitCamera = new THREE.Camera();
  /** ResizeObserver 给出的画布物理像素尺寸（比 clientWidth × dpr 取整更准） */
  private deviceSize: { w: number; h: number } | null = null;

  constructor(private container: HTMLElement) {
    // antialias 关：画布只接收第 2 步的全屏拷贝，抗锯齿由 RenderTarget 的 MSAA 负责
    this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(1); // 画布尺寸我们自己按物理像素算
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap; // 具体过滤方式由 World 按画质档位设置
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    const canvas = this.renderer.domElement;
    canvas.classList.add('game-canvas');
    container.appendChild(canvas);

    // 内部缓冲存线性颜色，8 位会在暗部出色带，所以优先用半浮点
    const ext = this.renderer.extensions;
    const floatOk = ext.has('EXT_color_buffer_float') || ext.has('EXT_color_buffer_half_float');
    this.targetType = floatOk ? THREE.HalfFloatType : THREE.UnsignedByteType;

    this.blitMaterial = new THREE.ShaderMaterial({
      uniforms: { tScene: { value: null } },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4( position.xy, 0.0, 1.0 );
        }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D tScene;
        varying vec2 vUv;
        void main() {
          gl_FragColor = texture2D( tScene, vUv );
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
      depthTest: false,
      depthWrite: false,
    });
    // 一个盖住整个视口的大三角形（比两个三角形的四边形少一条对角线接缝）
    const tri = new THREE.BufferGeometry();
    tri.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
    tri.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 2, 0, 0, 2], 2));
    const blitMesh = new THREE.Mesh(tri, this.blitMaterial);
    blitMesh.frustumCulled = false;
    this.blitScene.add(blitMesh);

    this.input = new Input(canvas);
    this.observeSize();
    bus.on('settings:changed', () => this.resize());
    this.resize();
  }

  /** 当前渲染视图：内部分辨率、放大倍数等（只读）。变化时会广播 'render:view' */
  get view(): Readonly<RenderView> {
    return this.currentView!;
  }

  /** 注册每帧回调，返回取消函数 */
  onUpdate(fn: Updater): () => void {
    this.updaters.add(fn);
    return () => this.updaters.delete(fn);
  }

  /** 重新计算分辨率。窗口尺寸 / 缩放 / 设置变化时自动调用，一般不需要手动调 */
  resize(): void {
    const dpr = window.devicePixelRatio || 1;
    const cssW = this.container.clientWidth || window.innerWidth;
    const cssH = this.container.clientHeight || window.innerHeight;
    let cw = Math.round(cssW * dpr);
    let ch = Math.round(cssH * dpr);
    // 精确值只用来修正取整误差（±1 像素）。差得更多说明它不可信——
    // 开发者工具 / 自动化测试模拟 DPR 时，device-pixel-content-box 报的仍是没乘 DPR 的数
    const d = this.deviceSize;
    if (d && Math.abs(d.w - cw) <= 1 && Math.abs(d.h - ch) <= 1) {
      cw = d.w;
      ch = d.h;
    }
    const view = computeView(cw, ch, dpr, getSettings());
    if (sameView(this.currentView, view)) return;
    this.currentView = view;

    const r = this.renderer;
    r.setSize(view.canvasWidth, view.canvasHeight, false); // CSS 尺寸由样式表控制（100%）

    const filter = view.mode === 'pixel' || view.scale === 1 ? THREE.NearestFilter : THREE.LinearFilter;
    if (this.target && this.target.samples !== view.samples) {
      this.target.dispose();
      this.target = null;
    }
    if (!this.target) {
      this.target = new THREE.WebGLRenderTarget(view.width, view.height, {
        type: this.targetType,
        samples: view.samples,
        depthBuffer: true,
        stencilBuffer: false,
        generateMipmaps: false,
      });
      this.blitMaterial.uniforms.tScene.value = this.target.texture;
    } else {
      this.target.setSize(view.width, view.height);
    }
    const tex = this.target.texture;
    if (tex.magFilter !== filter) {
      tex.magFilter = tex.minFilter = filter;
      tex.needsUpdate = true;
    }

    // 第 2 步的视口：像素风下是 (内部分辨率 × scale)，从左上角对齐，多出的不足 1 个虚拟像素被画布裁掉
    if (view.mode === 'pixel') {
      const vw = view.width * view.scale;
      const vh = view.height * view.scale;
      r.setViewport(0, view.canvasHeight - vh, vw, vh); // GL 视口原点在左下
    } else {
      r.setViewport(0, 0, view.canvasWidth, view.canvasHeight);
    }

    this.camera.aspect = view.width / view.height;
    this.camera.updateProjectionMatrix();
    setOutlineWidth(view.outlinePx, view.height, this.camera.fov);

    bus.emit('render:view', view);
    // 改画布尺寸会清空画面；立刻补画一帧，拖动窗口时不闪黑
    if (this.started) this.renderFrame();
  }

  start(): void {
    this.started = true;
    // UI 模块在 Engine 之后挂载，错过了构造时的那次广播，这里补发一次
    bus.emit('render:view', this.view);
    this.renderer.setAnimationLoop(() => {
      const dt = Math.min(this.clock.getDelta(), 1 / 20); // 防止切后台回来时 dt 爆炸
      this.time += dt;
      this.updaters.forEach((fn) => fn(dt, this.time));
      this.renderFrame();
      this.input.endFrame();
    });
  }

  private renderFrame(): void {
    const r = this.renderer;
    // renderer.info.render 的口径和以前一致：主场景这一遍的 draw call（three 在阴影遍之后清零），
    // 第 2 步不清零，只是累加 1 次 draw call
    r.info.autoReset = true;
    r.setRenderTarget(this.target);
    r.render(this.scene, this.camera);
    r.info.autoReset = false;
    r.setRenderTarget(null);
    r.render(this.blitScene, this.blitCamera);
  }

  /** 监听画布容器的尺寸。优先用 device-pixel-content-box 拿到精确的物理像素数（缩放比例是 125% / 150% 时也不差 1 像素） */
  private observeSize(): void {
    window.addEventListener('resize', () => this.resize());
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver((entries) => {
      const box = entries[0]?.devicePixelContentBoxSize?.[0];
      this.deviceSize = box ? { w: box.inlineSize, h: box.blockSize } : null;
      this.resize();
    });
    try {
      ro.observe(this.container, { box: 'device-pixel-content-box' });
    } catch {
      ro.observe(this.container); // Safari 等不支持 device-pixel-content-box：退回 clientWidth × dpr 取整
    }
  }
}
