/**
 * 地图卡定义 —— 整个项目最重要的契约。
 * 一张地图卡 = 一个城市/景点的小场景（约 100m × 100m）。
 * 新增地图卡：复制 src/maps/_template/，在 src/world/registry.ts 注册。规范见 docs/MAP_CARD_SPEC.md
 */
import type * as THREE from 'three';
import type { Palette, TimeId, TimeOfDay } from '@/render/palette';
import type { NpcDef } from '@/npc/types';

export interface MapCardDef {
  /** 唯一 id，小写英文，如 'tokyo' */
  id: string;
  /** 中文名，如 '东京' */
  name: string;
  /** 当地语言名，如 '東京' */
  nameLocal: string;
  /** 国家/地区 */
  country: string;
  /** 一句话介绍（显示在地图卡片上） */
  tagline: string;
  /** 调色板。这就是这张图的默认时刻，现有画面以它为准 */
  palette: Palette;
  /**
   * 可选的其他时刻（只覆盖光照和天空）。
   * 不要把「现在的默认时刻」再写一份进来。
   */
  times?: Partial<Record<TimeId, TimeOfDay>>;
  /** 出生点：位置 [x, z] + 朝向（弧度，0 = 朝 -Z 方向） */
  spawn: { x: number; z: number; yaw: number };
  /** 可行走范围：以原点为中心的正方形半边长（米） */
  halfSize: number;
  /** 场景中的 NPC */
  npcs?: NpcDef[];
  /** 开发用地图（如道具馆）：不在护照里显示，仍可用数字键进入 */
  devOnly?: boolean;
  /** 构建场景。只能通过 ctx 往场景里加东西，卸载时会自动清理 */
  build(ctx: MapBuildContext): void | Promise<void>;
}

export interface MapBuildContext {
  /** 本地图的根节点（不要直接用 ctx.root.add，用 ctx.add 以便处理碰撞） */
  readonly root: THREE.Group;
  readonly palette: Palette;
  /**
   * 往场景里加物体。
   * collide: true 时按物体包围盒生成碰撞体（玩家走不进去）。大物体（房子、墙）开 collide，小装饰别开。
   */
  add<T extends THREE.Object3D>(obj: T, opts?: { collide?: boolean }): T;
  /** 手动添加碰撞盒（世界坐标） */
  addCollider(box: THREE.Box3): void;
  /** 注册每帧动画（飘落的花瓣、旋转的风车...），卸载地图时自动注销 */
  onUpdate(fn: (dt: number, time: number) => void): void;
  /** 可复现的随机数 [0,1)，同一张卡每次生成一样的布局 */
  rand(): number;
  /** 玩家当前位置（只读，每帧更新）。特效跟随玩家时使用 */
  getPlayerPosition(): Readonly<THREE.Vector3>;
}
