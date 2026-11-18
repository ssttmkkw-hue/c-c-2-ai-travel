/**
 * World：负责地图卡的加载/卸载、灯光与调色板应用、碰撞数据。
 * 监听 'map:request'，加载后广播 'map:loaded'。
 */
import * as THREE from 'three';
import type { Engine } from '@/core/Engine';
import { bus } from '@/core/events';
import type { MapCardDef, MapBuildContext } from './MapCard';
import { TIME_IDS, type Palette, type TimeId, type TimeOfDay } from '@/render/palette';
import { getSettings } from '@/core/settings';
import { shadowConfig } from '@/render/quality';
import { refreshToonMaterials, setOutlineColor, setShadowTuning } from '@/render/toon';
import { batchStatic, probeDynamic } from '@/render/batch';
import { Sky } from '@/render/sky';
import { syncWaterFrame } from '@/render/water';
import { getCard } from './registry';
import { createRng } from './rng';
import { spawnNpcs } from '@/npc/spawn';

/**
 * 太阳阴影相机覆盖的范围（正交，半边长，米）。
 * 只罩玩家周围约 45 米，而不是整张 120 米的地图：同样的贴图，近处阴影像素更小。
 * 焦点每帧吸附到阴影贴图像素网格上，避免走路时影子边缘闪。
 */
const SHADOW_HALF = 45;
const SHADOW_NEAR = 1;
const SHADOW_FAR = 150;
/** 太阳到场景中心的距离（米）。只影响阴影相机放在哪，要让整张图落在 near~far 之间 */
const SUN_DISTANCE = 66;
/** 默认太阳方向（调色板没配 sunDirection 时用） */
const DEFAULT_SUN_DIR: [number, number, number] = [30, 50, 20];
const DEFAULT_SATURATION = 1.15;
/** 固定阴影偏移（米，朝光源方向）。只需盖住深度精度误差；倾斜面的误差由 toon.ts 的坡度偏移负责 */
const SHADOW_BIAS_M = 0.015;

export class World {
  current: MapCardDef | null = null;
  /** 当前地图所有碰撞盒（世界坐标） */
  colliders: THREE.Box3[] = [];
  /** 当前地图的 NPC 根节点（供交互检测） */
  npcs: { id: string; object: THREE.Object3D }[] = [];
  /** 玩家位置（由 Player 每帧写入），供地图卡 ctx.getPlayerPosition() 读取 */
  readonly playerPosition = new THREE.Vector3();

  private root: THREE.Group | null = null;
  private disposers: (() => void)[] = [];
  private sun = new THREE.DirectionalLight(0xffffff, 2);
  private hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1);
  private sky = new Sky();
  private loading = false;
  /** 从阴影焦点指向太阳的向量（长度固定）。调色板换太阳方向时更新 */
  private sunOffset = new THREE.Vector3();
  private readonly shadowRight = new THREE.Vector3();
  private readonly shadowUp = new THREE.Vector3();
  private readonly shadowForward = new THREE.Vector3();
  private readonly shadowFocus = new THREE.Vector3();
  private readonly worldUp = new THREE.Vector3(0, 1, 0);
  /** 时段插值。blendT >= 1 表示已经停在目标上 */
  private blendT = 1;
  private blendDur = 1;
  private readonly litFrom = createLit();
  private readonly litTo = createLit();
  private readonly litNow = createLit();
  /** 低画质隔帧更新阴影时，记住上一帧的吸附焦点 */
  private readonly shadowSnap = new THREE.Vector3(NaN, NaN, NaN);
  private shadowTick = 0;

  constructor(private engine: Engine) {
    const s = this.sun;
    this.setSunDirection(DEFAULT_SUN_DIR);
    s.castShadow = true;
    const c = s.shadow.camera;
    c.left = c.bottom = -SHADOW_HALF;
    c.right = c.top = SHADOW_HALF;
    c.near = SHADOW_NEAR;
    c.far = SHADOW_FAR;
    s.shadow.bias = -SHADOW_BIAS_M / (SHADOW_FAR - SHADOW_NEAR);
    s.shadow.normalBias = 0; // 不用法线偏移：它会把背光面往阴影里推，正好和卡通色阶打架（见 toon.ts 的阴影补丁）
    this.applyShadowQuality();
    bus.on('settings:changed', () => this.applyShadowQuality());
    // Player 在 World 之后才注册自己的 onUpdate。微任务排到同步初始化之后，
    // 这样阴影焦点用的是本帧已经写好的玩家位置，而不是上一帧的。
    queueMicrotask(() => engine.onUpdate((dt, t) => {
      this.tickTime(dt);
      this.updateShadowFocus();
      this.sky.setTime(t);
      const st = getSettings();
      syncWaterFrame(t, st.quality === 'low', st.renderMode === 'pixel');
    }));
    engine.scene.add(s, s.target, this.hemi, this.sky.mesh);
    this.sky.setBanded(getSettings().renderMode === 'pixel');
    bus.on('settings:changed', (st) => this.sky.setBanded(st.renderMode === 'pixel'));
    bus.on('map:request', ({ id }) => void this.load(id));
  }

  async load(id: string): Promise<void> {
    const card = getCard(id);
    if (!card || this.loading || card === this.current) return;
    this.loading = true;
    try {
      const waits: Promise<unknown>[] = [];
      bus.emit('map:loading', { from: this.current, to: card, waitFor: (p) => waits.push(p) });
      if (waits.length) await Promise.race([Promise.allSettled(waits), new Promise((r) => setTimeout(r, 3000))]);
      this.unload();
      await this.build(card);
    } catch (err) {
      console.error(`[World] 地图卡 ${id} 加载失败`, err);
    } finally {
      this.loading = false;
    }
  }

  private async build(card: MapCardDef): Promise<void> {
    const root = new THREE.Group();
    root.name = `map:${card.id}`;
    const rand = createRng(card.id);
    const updaters: ((dt: number, time: number) => void)[] = [];
    const ctx: MapBuildContext = {
      root,
      palette: card.palette,
      add: (obj, opts) => {
        root.add(obj);
        if (opts?.collide) {
          obj.updateMatrixWorld(true);
          this.colliders.push(new THREE.Box3().setFromObject(obj));
        }
        return obj;
      },
      addCollider: (box) => this.colliders.push(box.clone()),
      onUpdate: (fn) => {
        updaters.push(fn);
        this.disposers.push(this.engine.onUpdate(fn));
      },
      rand,
      getPlayerPosition: () => this.playerPosition,
    };
    this.current = card;
    this.applyPalette(card.palette);
    const queried = timeFromQuery();
    if (queried && card.times?.[queried]) this.setTimeOfDay(queried, 0);
    await card.build(ctx);
    this.batch(card, root, updaters);
    this.npcs = spawnNpcs(ctx, card.npcs ?? []);
    this.engine.scene.add(root);
    this.root = root;
    bus.emit('map:loaded', { card });
  }

  /**
   * 切到这张图的某个时刻。null = 回到默认调色板。
   * durationSec 为 0 时立刻跳过去；过渡期间每帧只改光照 uniform。
   * 太阳方向的单位向量 y 低于 0.2 会被抬起来，避免影子拉出阴影范围。
   * 过渡时阴影焦点照常跟着新的光方向走，光空间网格换基时影子边缘会跳一次。
   */
  setTimeOfDay(time: TimeId | null, durationSec = 0): void {
    const card = this.current;
    if (!card) return;
    if (time && !card.times?.[time]) return;
    copyLit(this.litNow, this.litFrom);
    if (time) fillTime(card.palette, card.times![time]!, this.litTo);
    else fillPalette(card.palette, this.litTo);
    const dur = Math.max(0, durationSec);
    if (dur <= 0) {
      this.blendT = 1;
      copyLit(this.litTo, this.litNow);
      this.pushLight(this.litNow);
    } else {
      this.blendDur = dur;
      this.blendT = 0;
      this.pushLight(this.litFrom);
    }
    bus.emit('time:changed', { mapId: card.id, time });
  }

  private unload(): void {
    this.disposers.forEach((d) => d());
    this.disposers = [];
    this.colliders = [];
    this.npcs = [];
    if (!this.root) return;
    this.engine.scene.remove(this.root);
    // 材质是全局缓存的（toonMaterial），只释放几何体（描边外壳多数和本体共用几何体，重复 dispose 无害）
    this.root.traverse((o) => {
      const mesh = o as THREE.Mesh;
      const geo = mesh.geometry as THREE.BufferGeometry | undefined;
      if (geo?.isBufferGeometry) geo.dispose();
      // 实例化网格的 instanceMatrix / instanceColor 要靠 mesh.dispose() 才从 GPU 属性表里摘掉
      if ((o as THREE.InstancedMesh).isInstancedMesh) (o as THREE.InstancedMesh).dispose();
      const mat = mesh.material;
      // 只放 ShaderMaterial（水面）。卡通材质和描边是全局缓存，不是 ShaderMaterial
      if (mat && !Array.isArray(mat) && (mat as THREE.ShaderMaterial).isShaderMaterial) mat.dispose();
    });
    this.root = null;
  }

  /**
   * 静态合批（见 src/render/batch.ts）。在 card.build() 之后、生成 NPC 之前做，所以 NPC 不会被并进去。
   * 会动的物体靠地图卡用 kit.dynamic() 标记。漏标的探测只在开发模式跑：
   * 它会用假时间多调 4 次 updater，正式构建不付这个代价，也要求作者自己标。
   */
  private batch(card: MapCardDef, root: THREE.Group, updaters: ((dt: number, time: number) => void)[]): void {
    const unmarked = import.meta.env.DEV ? probeDynamic(root, updaters) : [];
    const stats = batchStatic(root, { nested: true });
    if (import.meta.env.DEV) {
      if (unmarked.length) {
        console.warn(`[World] ${card.id}：有 ${unmarked.length} 个会动的物体没有用 kit.dynamic() 标记（已自动按动态处理）`, unmarked);
      }
      console.info(`[World] ${card.id} 静态合批：${stats.merged} 个 mesh → ${stats.batches} 个（${stats.triangles} 三角形）`);
    }
  }

  /** 按画面风格 + 画质档位设置阴影贴图分辨率和过滤方式（见 src/render/quality.ts 的 shadowConfig） */
  private applyShadowQuality(): void {
    const cfg = shadowConfig(getSettings());
    const shadowMap = this.engine.renderer.shadowMap;
    const type = cfg.filtered ? THREE.PCFSoftShadowMap : THREE.BasicShadowMap;
    if (shadowMap.type !== type) {
      shadowMap.type = type;
      refreshToonMaterials(); // 过滤方式编译在着色器里，换了要重编
    }
    const shadow = this.sun.shadow;
    if (shadow.mapSize.x !== cfg.mapSize) {
      shadow.mapSize.set(cfg.mapSize, cfg.mapSize);
      shadow.map?.dispose(); // 下一帧按新尺寸重建
      shadow.map = null;
    }
    // 坡度偏移 = 阴影贴图 1 像素在光线方向上能差出的深度 × 采样核半径（硬采样约 1 像素，PCF 约 2 像素）
    const texel = (SHADOW_HALF * 2) / cfg.mapSize;
    const kernel = cfg.filtered ? 2 : 1.25;
    setShadowTuning((texel * kernel) / (SHADOW_FAR - SHADOW_NEAR), cfg.hardEdge);
  }

  private applyPalette(p: Palette): void {
    this.blendT = 1;
    fillPalette(p, this.litNow);
    copyLit(this.litNow, this.litFrom);
    copyLit(this.litNow, this.litTo);
    this.pushLight(this.litNow);
  }

  private tickTime(dt: number): void {
    if (this.blendT >= 1) return;
    this.blendT = Math.min(1, this.blendT + dt / this.blendDur);
    lerpLit(this.litFrom, this.litTo, this.blendT, this.litNow);
    this.pushLight(this.litNow);
  }

  /** 把一份光照写进雾、太阳、半球光、天空和调色。几何体顶点色不动 */
  private pushLight(lit: Lit): void {
    const scene = this.engine.scene;
    const bg = scene.background instanceof THREE.Color ? scene.background : new THREE.Color();
    bg.copy(lit.fog);
    scene.background = bg;
    const fog = scene.fog instanceof THREE.Fog ? scene.fog : new THREE.Fog(0x000000, lit.fogNear, lit.fogFar);
    fog.color.copy(lit.fog);
    fog.near = lit.fogNear;
    fog.far = lit.fogFar;
    scene.fog = fog;
    this.setSunDirection(lit.sunDir);
    this.sky.set(lit.skyTop, lit.sky, lit.fog, lit.sun, this.sun.position, lit.cloud);
    this.engine.setGrade(lit.exposure, lit.saturation);
    this.sun.color.copy(lit.sun);
    this.sun.intensity = lit.sunIntensity;
    this.hemi.color.copy(lit.skyLight);
    this.hemi.groundColor.copy(lit.groundLight);
    this.hemi.intensity = lit.ambient;
    setOutlineColor(lit.outline);
  }

  /** 记下太阳方向，并算出和 three 的 Camera.lookAt（up = +Y）一致的阴影相机坐标轴 */
  private setSunDirection(dir: THREE.Vector3 | readonly [number, number, number]): void {
    const x = dir instanceof THREE.Vector3 ? dir.x : dir[0];
    const y = dir instanceof THREE.Vector3 ? dir.y : dir[1];
    const z = dir instanceof THREE.Vector3 ? dir.z : dir[2];
    const len = Math.hypot(x, y, z) || 1;
    // 默认调色板的 y 都高于 0.2，这条路径和原来的 setLength 一样
    if (y / len >= 0.2) {
      this.sunOffset.set(x, y, z).setLength(SUN_DISTANCE);
    } else {
      const nx = x / len;
      const nz = z / len;
      const hy = 0.2;
      const h = Math.sqrt(Math.max(0, 1 - hy * hy));
      const hlen = Math.hypot(nx, nz) || 1;
      this.sunOffset.set((nx / hlen) * h, hy, (nz / hlen) * h).setLength(SUN_DISTANCE);
    }
    this.shadowForward.copy(this.sunOffset).normalize();
    this.shadowRight.crossVectors(this.worldUp, this.shadowForward);
    if (this.shadowRight.lengthSq() < 1e-8) this.shadowRight.set(1, 0, 0);
    else this.shadowRight.normalize();
    this.shadowUp.crossVectors(this.shadowForward, this.shadowRight);
    this.updateShadowFocus();
  }

  /**
   * 把阴影相机挪到玩家附近，并吸附到阴影贴图的像素网格。
   * 吸附在世界固定的光空间里做：玩家没跨过半个阴影像素时，焦点不动，影子边缘不会跟着抖。
   */
  private updateShadowFocus(): void {
    const mapSize = this.sun.shadow.mapSize.x || 1024;
    const texel = (SHADOW_HALF * 2) / mapSize;
    const p = this.playerPosition;
    const lx = Math.round(this.shadowRight.dot(p) / texel) * texel;
    const ly = Math.round(this.shadowUp.dot(p) / texel) * texel;
    const lz = this.shadowForward.dot(p);
    this.shadowFocus.set(0, 0, 0).addScaledVector(this.shadowRight, lx).addScaledVector(this.shadowUp, ly).addScaledVector(this.shadowForward, lz);
    this.sun.target.position.copy(this.shadowFocus);
    this.sun.position.copy(this.shadowFocus).add(this.sunOffset);
    this.stepShadowUpdate();
  }

  /**
   * 低画质隔帧画阴影。焦点吸附跨格时这一帧强制更新。
   * 中 / 高保持 three 的 autoUpdate。renderer.info.render 不含阴影遍，所以这里不改变那份 draw call。
   */
  private stepShadowUpdate(): void {
    const shadowMap = this.engine.renderer.shadowMap;
    if (getSettings().quality !== 'low') {
      if (!shadowMap.autoUpdate) shadowMap.autoUpdate = true;
      return;
    }
    shadowMap.autoUpdate = false;
    const moved = !Number.isFinite(this.shadowSnap.x) || this.shadowFocus.distanceToSquared(this.shadowSnap) > 1e-8;
    this.shadowTick++;
    if (moved || this.shadowTick % 2 === 0) shadowMap.needsUpdate = true;
    this.shadowSnap.copy(this.shadowFocus);
  }
}

interface Lit {
  sky: THREE.Color;
  skyTop: THREE.Color;
  fog: THREE.Color;
  fogNear: number;
  fogFar: number;
  sun: THREE.Color;
  sunIntensity: number;
  sunDir: THREE.Vector3;
  skyLight: THREE.Color;
  groundLight: THREE.Color;
  ambient: number;
  exposure: number;
  saturation: number;
  outline: THREE.Color;
  cloud: number;
}

function createLit(): Lit {
  return {
    sky: new THREE.Color(),
    skyTop: new THREE.Color(),
    fog: new THREE.Color(),
    fogNear: 1,
    fogFar: 100,
    sun: new THREE.Color(),
    sunIntensity: 1,
    sunDir: new THREE.Vector3(1, 1, 0),
    skyLight: new THREE.Color(),
    groundLight: new THREE.Color(),
    ambient: 1,
    exposure: 1,
    saturation: DEFAULT_SATURATION,
    outline: new THREE.Color(),
    cloud: 0.4,
  };
}

function fillPalette(p: Palette, into: Lit): void {
  const dir = p.sunDirection ?? DEFAULT_SUN_DIR;
  into.sky.set(p.sky);
  into.skyTop.set(p.skyTop ?? p.sky);
  into.fog.set(p.fog);
  into.fogNear = p.fogNear;
  into.fogFar = p.fogFar;
  into.sun.set(p.sun);
  into.sunIntensity = p.sunIntensity;
  into.sunDir.set(dir[0], dir[1], dir[2]);
  into.skyLight.set(p.skyLight);
  into.groundLight.set(p.groundLight);
  into.ambient = p.ambientIntensity;
  into.exposure = p.exposure ?? 1;
  into.saturation = p.saturation ?? DEFAULT_SATURATION;
  into.outline.set(p.outline);
  into.cloud = p.cloudDensity ?? 0.4;
}

function fillTime(base: Palette, time: TimeOfDay, into: Lit): void {
  fillPalette(base, into);
  if (time.sky) into.sky.set(time.sky);
  if (time.skyTop) into.skyTop.set(time.skyTop);
  if (time.fog) into.fog.set(time.fog);
  if (time.fogNear !== undefined) into.fogNear = time.fogNear;
  if (time.fogFar !== undefined) into.fogFar = time.fogFar;
  if (time.sun) into.sun.set(time.sun);
  if (time.sunIntensity !== undefined) into.sunIntensity = time.sunIntensity;
  if (time.sunDirection) into.sunDir.set(time.sunDirection[0], time.sunDirection[1], time.sunDirection[2]);
  if (time.skyLight) into.skyLight.set(time.skyLight);
  if (time.groundLight) into.groundLight.set(time.groundLight);
  if (time.ambientIntensity !== undefined) into.ambient = time.ambientIntensity;
  if (time.exposure !== undefined) into.exposure = time.exposure;
  if (time.saturation !== undefined) into.saturation = time.saturation;
  if (time.outline) into.outline.set(time.outline);
  if (time.cloudDensity !== undefined) into.cloud = time.cloudDensity;
}

function copyLit(src: Lit, dst: Lit): void {
  dst.sky.copy(src.sky);
  dst.skyTop.copy(src.skyTop);
  dst.fog.copy(src.fog);
  dst.fogNear = src.fogNear;
  dst.fogFar = src.fogFar;
  dst.sun.copy(src.sun);
  dst.sunIntensity = src.sunIntensity;
  dst.sunDir.copy(src.sunDir);
  dst.skyLight.copy(src.skyLight);
  dst.groundLight.copy(src.groundLight);
  dst.ambient = src.ambient;
  dst.exposure = src.exposure;
  dst.saturation = src.saturation;
  dst.outline.copy(src.outline);
  dst.cloud = src.cloud;
}

function lerpLit(a: Lit, b: Lit, t: number, into: Lit): void {
  into.sky.copy(a.sky).lerp(b.sky, t);
  into.skyTop.copy(a.skyTop).lerp(b.skyTop, t);
  into.fog.copy(a.fog).lerp(b.fog, t);
  into.fogNear = a.fogNear + (b.fogNear - a.fogNear) * t;
  into.fogFar = a.fogFar + (b.fogFar - a.fogFar) * t;
  into.sun.copy(a.sun).lerp(b.sun, t);
  into.sunIntensity = a.sunIntensity + (b.sunIntensity - a.sunIntensity) * t;
  into.sunDir.copy(a.sunDir).lerp(b.sunDir, t);
  into.skyLight.copy(a.skyLight).lerp(b.skyLight, t);
  into.groundLight.copy(a.groundLight).lerp(b.groundLight, t);
  into.ambient = a.ambient + (b.ambient - a.ambient) * t;
  into.exposure = a.exposure + (b.exposure - a.exposure) * t;
  into.saturation = a.saturation + (b.saturation - a.saturation) * t;
  into.outline.copy(a.outline).lerp(b.outline, t);
  into.cloud = a.cloud + (b.cloud - a.cloud) * t;
}

function timeFromQuery(): TimeId | null {
  try {
    const v = new URLSearchParams(window.location.search).get('time');
    if (v && (TIME_IDS as readonly string[]).includes(v)) return v as TimeId;
  } catch {
    /* 没有 window 时当没写 */
  }
  return null;
}
