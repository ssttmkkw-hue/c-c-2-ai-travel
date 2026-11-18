/**
 * 东京地标：朱红鸟居、歇山顶本殿、狛犬，以及远处的红白铁塔剪影。
 * 正面朝 +Z（朝向参道 / 出生点）。
 */
import type * as THREE from 'three';
import type { Palette } from '@/render/palette';
import * as kit from '@/art/kit';
import { COLORS } from '@/art/colors';

/** 鸟居中心。柱心距原点的横向距离，供碰撞盒对齐。 */
export const TORII_PILLAR_X = 2.25;
export const TORII_Z = -8;
/** 本殿组的放置点（底部中心）。 */
export const SHRINE_Z = -31;
/** 本殿台阶最南端（世界坐标），狛犬站在这一线外侧。 */
export const SHRINE_FRONT_Z = SHRINE_Z + 5.15;

const PILLAR_H = 5.5;

/** 朱红鸟居：柱、贯、岛木、两端上翘的笠木、额束。高约 6.2m，净宽约 3.6m。 */
export function createTorii(p: Palette): THREE.Group {
  const red = p.accent[3];
  const black = COLORS.black;
  const x = TORII_PILLAR_X;
  const top = PILLAR_H;
  return kit.group(
    kit.cylinder(0.2, 0.3, PILLAR_H, red, { x: -x, y: PILLAR_H / 2, segments: 8 }),
    kit.cylinder(0.2, 0.3, PILLAR_H, red, { x, y: PILLAR_H / 2, segments: 8 }),
    kit.cylinder(0.4, 0.44, 0.26, red, { x: -x, y: 0.13, segments: 8 }),
    kit.cylinder(0.4, 0.44, 0.26, red, { x, y: 0.13, segments: 8 }),
    // 贯
    kit.box(x * 2 + 1.35, 0.28, 0.34, red, { y: top * 0.62 }),
    // 岛木
    kit.box(x * 2 + 0.85, 0.16, 0.46, black, { y: top * 0.82 }),
    // 笠木
    kit.box(x * 2 + 1.15, 0.3, 0.62, black, { y: top * 0.94 }),
    // 笠木两端上翘（外侧抬起）
    kit.box(1.2, 0.24, 0.52, black, { x: -(x + 1.15), y: top * 0.94 + 0.22, rz: -0.4 }),
    kit.box(1.2, 0.24, 0.52, black, { x: x + 1.15, y: top * 0.94 + 0.22, rz: 0.4 }),
    // 额束
    kit.box(1.2, 0.7, 0.18, red, { y: top * 0.7 }),
    kit.box(0.86, 0.42, 0.04, black, { y: top * 0.7, z: 0.12, outline: false }),
  );
}

/**
 * 神社本殿：石台、台阶、白墙朱柱、歇山顶（下层四坡 + 上层正面人字）、千木与胜男木。
 * 视觉组不含碰撞（屋顶出檐很大，碰撞由 index 按墙体单独加）。
 */
export function createShrine(p: Palette): THREE.Group {
  const white = p.primary[0];
  const tile = p.primary[3];
  const red = p.accent[3];
  const wallH = 3.15;
  const baseTop = 0.5;
  const w = 8.2;
  const d = 5.6;
  const bodyY = baseTop + wallH / 2;
  const roofBase = baseTop + wallH;

  const parts: THREE.Object3D[] = [
    kit.box(w + 2.6, baseTop, d + 2.2, COLORS.stone, { y: baseTop / 2 }),
    kit.box(4.4, 0.22, 1.15, COLORS.stoneLight, { y: 0.11, z: 4.55 }),
    kit.box(3.7, 0.2, 1.0, COLORS.stone, { y: 0.28, z: 3.65 }),
    kit.box(3.1, 0.16, 0.9, COLORS.stoneLight, { y: 0.44, z: 2.85 }),
    kit.box(w, wallH, d, white, { y: bodyY }),
    kit.box(1.35, 2.05, 0.08, COLORS.woodDark, { y: baseTop + 1.05, z: d / 2 + 0.05, outline: false }),
    kit.box(1.5, 1.05, 0.06, COLORS.wood, { x: -2.5, y: baseTop + 1.7, z: d / 2 + 0.05, outline: false }),
    kit.box(1.5, 1.05, 0.06, COLORS.wood, { x: 2.5, y: baseTop + 1.7, z: d / 2 + 0.05, outline: false }),
  ];

  for (const x of [-3.05, -1.05, 1.05, 3.05]) {
    parts.push(kit.cylinder(0.14, 0.18, wallH, red, {
      x, y: bodyY, z: d / 2 + 0.12, segments: 6,
    }));
  }

  // 歇山：下层四坡（顶点朝对角），上层人字脊沿进深、山面朝 +Z
  parts.push(kit.cone(6.15, 1.35, 4, tile, { y: roofBase + 0.42, ry: Math.PI / 4 }));
  parts.push(kit.prism(4.6, 1.35, 4.8, tile, { y: roofBase + 1.35, ry: Math.PI / 2 }));
  parts.push(kit.box(0.26, 0.16, 5.1, red, { y: roofBase + 2.1 }));
  for (const z of [-1.15, 0, 1.15]) {
    parts.push(kit.cylinder(0.09, 0.09, 0.85, COLORS.woodDark, {
      y: roofBase + 2.28, z, rz: Math.PI / 2, segments: 6,
    }));
  }
  // 千木只做正面可见的一对
  parts.push(
    kit.box(0.1, 0.75, 0.1, COLORS.woodDark, { y: roofBase + 2.15, z: 2.35, rz: 0.5 }),
    kit.box(0.1, 0.75, 0.1, COLORS.woodDark, { y: roofBase + 2.15, z: 2.35, rz: -0.5 }),
  );

  return kit.group(...parts);
}

/** 狛犬。高约 1.15m。正面朝 +Z。open 为张口（阿），否则闭口（吽）。 */
export function createKomainu(p: Palette, open: boolean): THREE.Group {
  const body = COLORS.stoneLight;
  return kit.group(
    kit.box(0.78, 0.16, 0.95, COLORS.stone, { y: 0.08 }),
    kit.box(0.82, 0.42, 0.5, body, { y: 0.42, z: -0.05 }),
    kit.ball(0.3, body, { y: 0.82, z: 0.26 }),
    kit.box(0.18, 0.12, 0.2, body, { y: 0.74, z: 0.48 }),
    kit.cone(0.07, 0.16, 4, body, { x: -0.12, y: 1.08, z: 0.24 }),
    kit.cone(0.07, 0.16, 4, body, { x: 0.12, y: 1.08, z: 0.24 }),
    kit.box(0.34, 0.07, 0.06, p.accent[3], { y: 0.66, z: 0.38, outline: false }),
    open
      ? kit.box(0.12, 0.08, 0.04, COLORS.black, { y: 0.74, z: 0.58, outline: false })
      : kit.box(0.14, 0.035, 0.04, COLORS.black, { y: 0.72, z: 0.58, outline: false }),
  );
}

/**
 * 红白铁塔剪影（东京塔的样子，不追求精确）。高约 28m。
 * 四条斜腿 + 红白塔身 + 瞭望层 + 天线。
 */
export function createRedWhiteTower(p: Palette): THREE.Group {
  const red = p.accent[3];
  const white = COLORS.white;
  const parts: THREE.Object3D[] = [];
  const legH = 12;
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const leg = kit.box(0.38, legH, 0.38, red, { y: legH / 2 });
      leg.position.set(sx * 2.15, legH / 2, sz * 2.15);
      leg.rotation.z = -sx * 0.16;
      leg.rotation.x = sz * 0.16;
      parts.push(leg);
    }
  }
  const bands: Array<[number, number, number, string]> = [
    [4.6, 3.2, 1.6, red],
    [3.8, 3.0, 4.6, white],
    [3.1, 2.8, 7.4, red],
    [2.5, 2.6, 10.0, white],
    [3.6, 1.15, 12.2, red],
    [2.15, 3.4, 14.4, red],
    [2.7, 0.7, 16.4, white],
  ];
  for (const [w, h, y, color] of bands) {
    parts.push(kit.box(w, h, w, color, { y: y + h / 2 }));
  }
  parts.push(
    kit.cylinder(0.12, 0.28, 5.2, red, { y: 19.6, segments: 6 }),
    kit.cylinder(0.04, 0.08, 3.2, white, { y: 23.6, segments: 6 }),
  );
  return kit.group(...parts);
}
