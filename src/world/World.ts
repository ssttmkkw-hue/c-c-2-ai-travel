/**
 * World：负责地图卡的加载/卸载、灯光与调色板应用、碰撞数据。
 * 监听 'map:request'，加载后广播 'map:loaded'。
 */
import * as THREE from 'three';
import type { Engine } from '@/core/Engine';
import { bus } from '@/core/events';
import type { MapCardDef, MapBuildContext } from './MapCard';
import type { Palette } from '@/render/palette';
import { setOutlineColor } from '@/render/toon';
import { getCard } from './registry';
import { createRng } from './rng';
import { spawnNpcs } from '@/npc/spawn';

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
  private loading = false;

  constructor(private engine: Engine) {
    const s = this.sun;
    s.position.set(30, 50, 20);
    s.castShadow = true;
    s.shadow.mapSize.set(2048, 2048);
    const c = s.shadow.camera;
    c.left = c.bottom = -60;
    c.right = c.top = 60;
    c.near = 1;
    c.far = 150;
    s.shadow.bias = -0.0005;
    s.shadow.normalBias = 0.08;
    engine.scene.add(s, s.target, this.hemi);
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
      onUpdate: (fn) => this.disposers.push(this.engine.onUpdate(fn)),
      rand,
      getPlayerPosition: () => this.playerPosition,
    };
    this.applyPalette(card.palette);
    await card.build(ctx);
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
    // 材质是全局缓存的（toonMaterial），只释放几何体
    this.root.traverse((o) => {
      if ((o as THREE.Mesh).isMesh && o.name !== '__outline') (o as THREE.Mesh).geometry.dispose();
    });
    this.root = null;
  }

  private applyPalette(p: Palette): void {
    const scene = this.engine.scene;
    scene.background = new THREE.Color(p.sky);
    scene.fog = new THREE.Fog(p.fog, p.fogNear, p.fogFar);
    this.sun.color.set(p.sun);
    this.sun.intensity = p.sunIntensity;
    this.hemi.color.set(p.skyLight);
    this.hemi.groundColor.set(p.groundLight);
    this.hemi.intensity = p.ambientIntensity;
    setOutlineColor(p.outline);
  }
}
