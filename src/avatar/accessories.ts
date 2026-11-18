/**
 * 服装配件。全部用 kit 拼。
 * 头上配件挂到 head（原点在脖子）；身上配件挂到 torso（原点在腰部，即躯干底部中心）。
 * chibi 的躯干方块中心在 torso 上方 0.2，所以腰带大约在 y≈0.12，领子和围巾靠近躯干顶部。
 * chibi.setOutfit 换装时会拆掉 head 和 torso 上 userData.accessory 标记的旧配件，避免叠两层。
 * 角色面朝 -Z。草、木用 COLORS；布料颜色由服装定义传入。
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

/** 条纹围巾：绕在躯干上沿，两条尾巴垂在胸前（-Z）。挂在 torso 上 */
export function stripedScarf(a: string, b: string): Group {
  return kit.group(
    kit.box(0.42, 0.1, 0.38, a, { y: 0.3 }),
    kit.box(0.34, 0.055, 0.3, b, { y: 0.3, outline: false }),
    kit.box(0.12, 0.22, 0.06, a, { x: -0.09, y: 0.14, z: -0.26 }),
    kit.box(0.12, 0.14, 0.06, b, { x: -0.09, y: -0.02, z: -0.26 }),
    kit.box(0.12, 0.18, 0.06, b, { x: 0.1, y: 0.16, z: -0.26 }),
    kit.box(0.12, 0.12, 0.06, a, { x: 0.1, y: 0.02, z: -0.26 }),
  );
}

/** 浴衣腰带。挂在 torso 上，比躯干描边更厚一圈，结在背后（+Z） */
export function obi(band: string, bow: string): Group {
  return kit.group(
    kit.box(0.54, 0.16, 0.42, band, { y: 0.12 }),
    kit.box(0.48, 0.05, 0.44, bow, { y: 0.12, outline: false }),
    kit.box(0.22, 0.18, 0.1, bow, { y: 0.18, z: 0.26 }),
    kit.box(0.12, 0.2, 0.08, band, { y: 0.02, z: 0.28 }),
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
 * 条纹衫身上的横条。上衣网格只有一种颜色，色带盖在躯干上（比描边壳更宽），袖子仍用 top 色。
 * 挂在 torso 上，中心对齐躯干方块（y = 0.2）。
 */
export function shirtStripes(a: string, b: string): Group {
  const stripes = [a, b, a, b].map((color, i) =>
    kit.box(0.52, 0.09, 0.42, color, { y: 0.28 - i * 0.08 }),
  );
  return kit.group(...stripes);
}

/** 水手领，挂在 torso 上沿，让学生装和纯色上衣区分开 */
export function sailorCollar(cloth: string, ribbon: string): Group {
  return kit.group(
    kit.box(0.44, 0.07, 0.32, cloth, { y: 0.29 }),
    kit.box(0.12, 0.2, 0.05, cloth, { x: -0.07, y: 0.19, z: -0.16, rz: 0.5 }),
    kit.box(0.12, 0.2, 0.05, cloth, { x: 0.07, y: 0.19, z: -0.16, rz: -0.5 }),
    kit.box(0.12, 0.08, 0.05, ribbon, { y: 0.23, z: -0.18 }),
    kit.box(0.05, 0.12, 0.04, ribbon, { y: 0.16, z: -0.18, outline: false }),
  );
}
