/**
 * 服装配件。全部用 kit 拼，挂到角色 head 上（chibi.setOutfit 负责拆旧的，避免叠两层）。
 * head 原点在脖子，+Y 朝上，角色面朝 -Z。
 * 腰带、水手领、条纹衫色带用负 Y 落到躯干上，仍是头的子节点，走路和跳跃会跟着头一起动。
 * 草、木用 COLORS；布料颜色由服装定义传入。
 */
import type { Group } from 'three';
import * as kit from '@/art/kit';
import { COLORS } from '@/art/colors';

const STRAW = COLORS.woodLight;

/** 斗笠：扁圆锥，压在头发上 */
export function sugegasa(band: string): Group {
  return kit.group(
    kit.cone(0.44, 0.2, 8, STRAW, { y: 0.5 }),
    kit.cylinder(0.34, 0.34, 0.035, band, { y: 0.46, segments: 8 }),
    kit.ball(0.04, band, { y: 0.61, outline: false, shadow: false }),
  );
}

/** 草帽：宽檐 + 帽冠 + 帽带 */
export function strawHat(band: string): Group {
  return kit.group(
    kit.cylinder(0.36, 0.36, 0.04, STRAW, { y: 0.4, segments: 8 }),
    kit.cylinder(0.18, 0.18, 0.04, band, { y: 0.45, segments: 8 }),
    kit.cylinder(0.15, 0.17, 0.14, STRAW, { y: 0.53, segments: 8 }),
  );
}

/** 贝雷帽，稍偏向一侧，底边压进头发 */
export function beret(color: string): Group {
  return kit.group(
    kit.cylinder(0.26, 0.22, 0.08, color, { x: 0.03, y: 0.4, rz: 0.18, segments: 8 }),
    kit.ball(0.045, color, { x: 0.1, y: 0.45, outline: false, shadow: false }),
  );
}

/** 条纹围巾：绕脖子，两条尾巴垂在胸前（-Z），避免看成领带 */
export function stripedScarf(a: string, b: string): Group {
  return kit.group(
    kit.box(0.42, 0.1, 0.38, a, { y: -0.04 }),
    kit.box(0.34, 0.055, 0.3, b, { y: -0.04, outline: false }),
    kit.box(0.12, 0.22, 0.06, a, { x: -0.09, y: -0.2, z: -0.26 }),
    kit.box(0.12, 0.14, 0.06, b, { x: -0.09, y: -0.36, z: -0.26 }),
    kit.box(0.12, 0.18, 0.06, b, { x: 0.1, y: -0.18, z: -0.26 }),
    kit.box(0.12, 0.12, 0.06, a, { x: 0.1, y: -0.32, z: -0.26 }),
  );
}

/** 浴衣腰带。比躯干描边更厚一圈，负 Y 落在腰上，结在背后（+Z） */
export function obi(band: string, bow: string): Group {
  return kit.group(
    kit.box(0.54, 0.16, 0.42, band, { y: -0.22 }),
    kit.box(0.48, 0.05, 0.44, bow, { y: -0.22, outline: false }),
    kit.box(0.22, 0.18, 0.1, bow, { y: -0.16, z: 0.26 }),
    kit.box(0.12, 0.2, 0.08, band, { y: -0.32, z: 0.28 }),
  );
}

/** 阿拉伯头巾 + 黑色头箍 */
export function keffiyeh(cloth: string, pattern: string): Group {
  const cord = COLORS.black;
  return kit.group(
    kit.box(0.58, 0.12, 0.52, cloth, { y: 0.4 }),
    kit.box(0.5, 0.045, 0.54, pattern, { y: 0.38, outline: false }),
    kit.box(0.16, 0.44, 0.2, cloth, { x: -0.34, y: 0.06, z: -0.04 }),
    kit.box(0.1, 0.3, 0.12, pattern, { x: -0.36, y: 0.0, z: -0.1, outline: false }),
    kit.box(0.16, 0.44, 0.2, cloth, { x: 0.34, y: 0.06, z: -0.04 }),
    kit.box(0.1, 0.3, 0.12, pattern, { x: 0.36, y: 0.0, z: -0.1, outline: false }),
    kit.box(0.52, 0.045, 0.1, cord, { y: 0.44, z: -0.16 }),
    kit.box(0.52, 0.045, 0.1, cord, { y: 0.44, z: 0.16 }),
    kit.box(0.1, 0.045, 0.36, cord, { y: 0.44, x: -0.22 }),
    kit.box(0.1, 0.045, 0.36, cord, { y: 0.44, x: 0.22 }),
  );
}

/** 法老头饰：中脊用三棱柱，两侧垂带，额前小金饰 */
export function nemes(cloth: string, stripe: string, gold: string): Group {
  return kit.group(
    kit.box(0.56, 0.1, 0.5, cloth, { y: 0.38 }),
    kit.prism(0.5, 0.12, 0.36, cloth, { y: 0.46, ry: Math.PI / 2 }),
    kit.box(0.46, 0.04, 0.52, stripe, { y: 0.4, outline: false }),
    kit.box(0.22, 0.04, 0.5, stripe, { y: 0.48, outline: false }),
    kit.box(0.12, 0.42, 0.1, cloth, { x: -0.34, y: 0.04, z: -0.12 }),
    kit.box(0.06, 0.34, 0.05, stripe, { x: -0.34, y: 0.02, z: -0.16, outline: false }),
    kit.box(0.12, 0.42, 0.1, cloth, { x: 0.34, y: 0.04, z: -0.12 }),
    kit.box(0.06, 0.34, 0.05, stripe, { x: 0.34, y: 0.02, z: -0.16, outline: false }),
    kit.cone(0.04, 0.09, 6, gold, { y: 0.32, z: -0.26 }),
  );
}

/**
 * 巴黎一套：贝雷帽 + 条纹围巾 + 躯干条纹。
 * 上衣网格只有一种颜色，条纹色带盖在躯干上，袖子仍用 top 色。
 */
export function parisLook(beretColor: string, shirtA: string, shirtB: string, scarfA: string, scarfB: string): Group {
  // 比躯干描边更宽，否则条纹会被描边壳吃掉
  const stripes = [shirtA, shirtB, shirtA, shirtB].map((color, i) =>
    kit.box(0.52, 0.09, 0.42, color, { y: -0.06 - i * 0.08 }),
  );
  return kit.group(beret(beretColor), stripedScarf(scarfA, scarfB), ...stripes);
}

/** 水手领，让学生装和纯色上衣区分开 */
export function sailorCollar(cloth: string, ribbon: string): Group {
  return kit.group(
    kit.box(0.44, 0.07, 0.32, cloth, { y: -0.05 }),
    kit.box(0.12, 0.2, 0.05, cloth, { x: -0.07, y: -0.15, z: -0.16, rz: 0.5 }),
    kit.box(0.12, 0.2, 0.05, cloth, { x: 0.07, y: -0.15, z: -0.16, rz: -0.5 }),
    kit.box(0.12, 0.08, 0.05, ribbon, { y: -0.11, z: -0.18 }),
    kit.box(0.05, 0.12, 0.04, ribbon, { y: -0.18, z: -0.18, outline: false }),
  );
}
