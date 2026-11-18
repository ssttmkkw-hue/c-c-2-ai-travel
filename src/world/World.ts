/**
 * World：负责地图卡的加载/卸载、灯光与调色板应用、碰撞数据。
 * 监听 'map:request'，加载后广播 'map:loaded'。
 */
import * as THREE from 'three';
import type { Engine } from '@/core/Engine';
import { bus } from '@/core/events';
import type { MapCardDef, MapBuildContext } from './MapCard';
import type { Palette } from '@/render/palette';
import { getSettings } from '@/core/settings';
import { shadowConfig } from '@/render/quality';
import { refreshToonMaterials, setOutlineColor, setShadowTuning } from '@/render/toon';
import { batchStatic, probeDynamic } from '@/render/batch';
import { Sky } from '@/render/sky';
import { getCard } from './registry';
import { createRng } from './rng';
import { spawnNpcs } from '@/npc/spawn';

/** 太阳阴影相机覆盖的范围（正交，半边长，米）。要盖住整张地图卡 + 外圈远景 */
const SHADOW_HALF = 60;
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

  constructor(private engine: Engine) {
    const s = this.sun;
    s.position.set(...DEFAULT_SUN_DIR).setLength(SUN_DISTANCE);
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
    this.applyPalette(card.palette);
    await card.build(ctx);
    this.batch(card, root, updaters);
    this.npcs = spawnNpcs(ctx, card.npcs ?? []);
    this.engine.scene.add(root);
    this.root = root;
    this.current = card;
    bus.emit('map:loaded', { card });
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
      const geo = (o as THREE.Mesh).geometry as THREE.BufferGeometry | undefined;
      if (geo?.isBufferGeometry) geo.dispose();
    });
    this.root = null;
  }

  /**
   * 静态合批（见 src/render/batch.ts）。在 card.build() 之后、生成 NPC 之前做，所以 NPC 不会被并进去。
   * 会动的物体靠地图卡用 kit.dynamic() 标记；漏标的用 probeDynamic 兜底，dev 模式下提示补标。
   */
  private batch(card: MapCardDef, root: THREE.Group, updaters: ((dt: number, time: number) => void)[]): void {
    const unmarked = probeDynamic(root, updaters);
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
    const scene = this.engine.scene;
    // 天空 = 穹顶渐变（地平线是雾色 → 天顶色）；background 只是穹顶没画到时的兜底
    scene.background = new THREE.Color(p.fog);
    scene.fog = new THREE.Fog(p.fog, p.fogNear, p.fogFar);
    this.sun.position.set(...(p.sunDirection ?? DEFAULT_SUN_DIR)).setLength(SUN_DISTANCE);
    this.sky.set(p.skyTop ?? p.sky, p.sky, p.fog, p.sun, this.sun.position);
    this.engine.setGrade(p.exposure ?? 1, p.saturation ?? DEFAULT_SATURATION);
    this.sun.color.set(p.sun);
    this.sun.intensity = p.sunIntensity;
    this.hemi.color.set(p.skyLight);
    this.hemi.groundColor.set(p.groundLight);
    this.hemi.intensity = p.ambientIntensity;
    setOutlineColor(p.outline);
  }
}
