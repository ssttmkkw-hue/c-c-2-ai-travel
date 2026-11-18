/**
 * 吉萨地标：三座台阶金字塔、狮身人面像、方尖碑。
 * 正面朝 +Z（朝向石板路 / 出生点）。
 */
import type * as THREE from 'three';
import type { Palette } from '@/render/palette';
import * as kit from '@/art/kit';

/** 胡夫（最大，路的尽头正前方）。底边 16m，台阶顶约 11.2m，再加塔尖。 */
export const GREAT = { x: 0, z: -26, base: 16, height: 13, layers: 8, door: true };
/** 哈夫拉，靠左、稍近。狮身人面像在它前面偏东。 */
export const KHAFRE = { x: -19, z: -20, base: 11, height: 8.6, layers: 6, door: false };
/** 门卡乌拉，右侧最小。 */
export const MENKAURE = { x: 18, z: -17, base: 7.6, height: 5.8, layers: 5, door: false };

/** 狮身人面像底部中心。面朝 +Z。 */
export const SPHINX = { x: -11.2, z: -8.2 };

interface PyramidSpec {
  base: number;
  height: number;
  layers: number;
  door: boolean;
}

/** 叠层方台 + 四棱塔尖。层与层错色，台阶从正面就能看见。 */
export function createPyramid(p: Palette, spec: PyramidSpec): THREE.Group {
  const { base, height, layers, door } = spec;
  const stepH = (height * 0.86) / layers;
  const parts: THREE.Object3D[] = [];
  let topW = base;
  for (let i = 0; i < layers; i++) {
    const w = base * ((layers - i) / layers);
    topW = w;
    const color = i % 2 === 0 ? p.primary[0] : p.primary[1];
    // 每层比层高矮一点，层与层之间留一道缝。最底层不留缝、直接落地：
    // 悬空几厘米的话，底下那圈细细的影子在像素风下会变成一排虚线
    const h = i === 0 ? stepH * 0.97 : stepH * 0.94;
    const y = i === 0 ? h / 2 : i * stepH + stepH / 2;
    parts.push(kit.box(w, h, w, color, { y }));
  }
  const capH = stepH * 1.7;
  parts.push(kit.cone(topW * 0.62, capH, 4, p.accent[2], {
    y: layers * stepH + capH * 0.32,
    ry: Math.PI / 4,
  }));
  if (door) {
    const z = base / 2;
    parts.push(kit.box(2.4, 2.5, 0.55, p.primary[2], { y: 1.45, z: z - 0.2 }));
    parts.push(kit.box(1.45, 1.85, 0.16, p.outline, { y: 1.15, z: z + 0.02, outline: false }));
  }
  return kit.group(...parts);
}

/** 低模狮身人面像。身体朝北、脸朝 +Z。高约 2.6m，长约 5.4m。 */
export function createSphinx(p: Palette): THREE.Group {
  const stone = p.primary[1];
  const shade = p.primary[2];
  const gold = p.accent[2];
  const blue = p.accent[0];
  return kit.group(
    kit.box(2.5, 0.28, 5.5, shade, { y: 0.14 }),
    kit.box(1.35, 1.02, 3.05, stone, { y: 0.82, z: -0.4 }),
    kit.ball(0.62, stone, { y: 1.12, z: -1.6 }),
    kit.box(1.2, 0.78, 0.72, shade, { y: 0.72, z: 1.15 }),
    kit.box(0.4, 0.28, 1.4, stone, { x: -0.4, y: 0.4, z: 1.9 }),
    kit.box(0.4, 0.28, 1.4, stone, { x: 0.4, y: 0.4, z: 1.9 }),
    kit.box(0.55, 0.5, 0.48, stone, { y: 1.42, z: 1.32, rx: -0.3 }),
    kit.ball(0.48, stone, { y: 2.02, z: 1.52 }),
    kit.box(0.72, 0.16, 0.55, gold, { y: 2.4, z: 1.48 }),
    kit.box(0.2, 0.72, 0.12, blue, { x: -0.32, y: 1.68, z: 1.42, rz: 0.18 }),
    kit.box(0.2, 0.72, 0.12, blue, { x: 0.32, y: 1.68, z: 1.42, rz: -0.18 }),
    kit.cone(0.1, 0.26, 4, shade, { x: -0.26, y: 2.38, z: 1.4 }),
    kit.cone(0.1, 0.26, 4, shade, { x: 0.26, y: 2.38, z: 1.4 }),
    kit.box(0.1, 0.38, 0.1, gold, { y: 1.52, z: 1.95 }),
    kit.cylinder(0.06, 0.05, 0.7, shade, { y: 1.12, z: -2.1, rx: 1.15, segments: 6 }),
  );
}

/** 方尖碑。高约 4.1m。柱身四棱，正面朝 +Z。 */
export function createObelisk(p: Palette): THREE.Group {
  return kit.group(
    kit.box(1.05, 0.28, 1.05, p.primary[2], { y: 0.14 }),
    kit.cylinder(0.16, 0.32, 3.15, p.primary[0], { y: 1.85, ry: Math.PI / 4, segments: 4 }),
    kit.cone(0.2, 0.55, 4, p.accent[2], { y: 3.7, ry: Math.PI / 4 }),
  );
}
