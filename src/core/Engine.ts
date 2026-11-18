/**
 * 引擎：渲染器、主循环、更新回调。
 *
 * 像素化原理：WebGL 画布按 (窗口尺寸 / pixelSize) 的低分辨率渲染，
 * 再用 CSS 拉伸到全屏 + `image-rendering: pixelated`，得到清晰的像素块。
 * 如果以后要做调色板量化 / 抖动等后期效果，在 render() 里改成渲染到 RenderTarget 再走后期 pass。
 */
import * as THREE from 'three';
import { Input } from './Input';
import { bus } from './events';
import { getSettings } from './settings';

export type Updater = (dt: number, time: number) => void;

export class Engine {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(55, 1, 0.1, 400);
  readonly input: Input;
  private updaters = new Set<Updater>();
  private clock = new THREE.Clock();
  private time = 0;

  constructor(private container: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(1);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.BasicShadowMap; // 硬阴影更贴合像素风
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    const canvas = this.renderer.domElement;
    canvas.classList.add('game-canvas');
    container.appendChild(canvas);

    this.input = new Input(canvas);
    window.addEventListener('resize', () => this.resize());
    bus.on('settings:changed', () => this.resize());
    this.resize();
  }

  /** 注册每帧回调，返回取消函数 */
  onUpdate(fn: Updater): () => void {
    this.updaters.add(fn);
    return () => this.updaters.delete(fn);
  }

  resize(): void {
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    const ps = Math.max(1, Math.round(getSettings().pixelSize));
    this.renderer.setSize(Math.ceil(w / ps), Math.ceil(h / ps), false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  start(): void {
    this.renderer.setAnimationLoop(() => {
      const dt = Math.min(this.clock.getDelta(), 1 / 20); // 防止切后台回来时 dt 爆炸
      this.time += dt;
      this.updaters.forEach((fn) => fn(dt, this.time));
      this.renderer.render(this.scene, this.camera);
      this.input.endFrame();
    });
  }
}
