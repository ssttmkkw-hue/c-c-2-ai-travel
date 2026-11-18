/**
 * 地面细节：给一大片纯色地面加一点质感。全部用 kit.instances（每类 1 次 draw call），不投影、不碰撞。
 *
 *   addGroundDetail(ctx, {
 *     half: 40,
 *     avoid: [[-2.4, -30, 2.4, 26]],            // 路 / 水面 / 广场上不放
 *     tiles: { count: 220, grid: 1.5 },          // 铺装地面：对齐网格的深浅色块
 *     tufts: { count: 90, colors: p.foliage },   // 小草丛
 *     pebbles: { count: 120, colors: [COLORS.stone, COLORS.stoneLight] },
 *   });
 *
 * 位置用 ctx.rand()，同一张卡每次生成的一样。
 */
import * as THREE from 'three';
import type { MapBuildContext } from '@/world/MapCard';
import * as kit from '@/art/kit';
import { getSettings } from '@/core/settings';
import { DETAIL_SCALE } from '@/render/quality';
import { pick } from '@/render/palette';

/** [minX, minZ, maxX, maxZ] */
export type Rect = [number, number, number, number];

export interface GroundDetailOpts {
  /** 铺设范围：以原点为中心的正方形半边长（米） */
  half: number;
  /** 这些矩形里不放东西 */
  avoid?: Rect[];
  /**
   * 地面色块：比地面略深 / 略浅的薄片。
   * grid 有值 → 对齐网格的方块（石板 / 铺装的感觉）；没有 → 随机朝向的长条（沙地波纹 / 泥土的感觉）
   */
  tiles?: { count: number; grid?: number; size?: [number, number]; contrast?: number };
  /** 小草丛：每丛 3~5 根 */
  tufts?: { count: number; colors: string[] };
  /** 小石子 */
  pebbles?: { count: number; colors: string[] };
}

export function addGroundDetail(ctx: MapBuildContext, o: GroundDetailOpts): void {
  const { rand } = ctx;
  const avoid = o.avoid ?? [];
  const blocked = (x: number, z: number, margin: number) =>
    avoid.some(([x0, z0, x1, z1]) => x > x0 - margin && x < x1 + margin && z > z0 - margin && z < z1 + margin);
  /** 在范围内随机找一个不在避让区里的点（找不到就放弃） */
  const spot = (margin: number): [number, number] | null => {
    for (let tries = 0; tries < 8; tries++) {
      const x = (rand() * 2 - 1) * o.half;
      const z = (rand() * 2 - 1) * o.half;
      if (!blocked(x, z, margin)) return [x, z];
    }
    return null;
  };

  if (o.tiles) {
    const t = o.tiles;
    const [min, max] = t.size ?? [1, 2.6];
    const contrast = t.contrast ?? 0.035;
    const items: kit.InstanceItem[] = [];
    const placed: Array<[number, number, number]> = []; // [x, z, 半径]：色块之间不重叠（同一高度重叠会闪）
    for (let i = 0; i < t.count; i++) {
      const at = spot(0);
      if (!at) continue;
      let [x, z] = at;
      let sx = min + rand() * (max - min);
      let sz = min + rand() * (max - min);
      let ry = 0;
      if (t.grid) {
        sx = Math.max(1, Math.round(sx / t.grid)) * t.grid;
        sz = Math.max(1, Math.round(sz / t.grid)) * t.grid;
        // 边对齐网格线
        x = Math.round(x / t.grid) * t.grid + (sx / 2) % t.grid;
        z = Math.round(z / t.grid) * t.grid + (sz / 2) % t.grid;
      } else {
        sz *= 0.45;
        ry = rand() * Math.PI;
      }
      const r = Math.hypot(sx, sz) / 2;
      if (placed.some(([px, pz, pr]) => Math.hypot(px - x, pz - z) < pr + r)) continue;
      placed.push([x, z, r]);
      // 深浅交替，幅度很小：远看是质感，不是花纹
      const shade = (rand() < 0.5 ? -1 : 0.8) * contrast * (0.6 + rand() * 0.4);
      items.push({ x, z, y: 0.006, ry, sx, sz, color: new THREE.Color(ctx.palette.ground).offsetHSL(0, 0, shade) });
    }
    placeScaled(ctx, kit.instances(kit.box(1, 0.004, 1, ctx.palette.ground, { outline: false }), items));
  }

  if (o.tufts) {
    const items: kit.InstanceItem[] = [];
    for (let i = 0; i < o.tufts.count; i++) {
      const at = spot(0.4);
      if (!at) continue;
      const blades = 3 + Math.floor(rand() * 3);
      for (let b = 0; b < blades; b++) {
        items.push({
          x: at[0] + (rand() - 0.5) * 0.36,
          z: at[1] + (rand() - 0.5) * 0.36,
          ry: rand() * Math.PI * 2,
          rx: (rand() - 0.5) * 0.5,
          rz: (rand() - 0.5) * 0.5,
          s: 0.7 + rand() * 0.7,
          color: pick(o.tufts.colors, i + b),
        });
      }
    }
    placeScaled(ctx, kit.instances(kit.cone(0.07, 0.3, 3, ctx.palette.ground, { y: 0.15, outline: false }), items));
  }

  if (o.pebbles) {
    const items: kit.InstanceItem[] = [];
    for (let i = 0; i < o.pebbles.count; i++) {
      const at = spot(0.2);
      if (!at) continue;
      items.push({
        x: at[0],
        z: at[1],
        y: 0.02,
        ry: rand() * Math.PI * 2,
        s: 0.6 + rand() * 1.1,
        sy: 0.55,
        color: pick(o.pebbles.colors, i),
      });
    }
    placeScaled(ctx, kit.instances(kit.ball(0.09, ctx.palette.ground, { outline: false }), items));
  }
}

/**
 * 按画质档位少画一些实例。随机数仍然按满数量消耗，换档位不会把剩下的东西挪位置。
 * 不改 visible：加载时的动态探测会把 visible 变化当成「没标记的动画」。
 */
function placeScaled(ctx: MapBuildContext, mesh: THREE.InstancedMesh): void {
  const full = mesh.count;
  const apply = () => {
    mesh.count = Math.round(full * DETAIL_SCALE[getSettings().quality]);
  };
  apply();
  ctx.add(mesh);
  ctx.onUpdate(apply);
}
