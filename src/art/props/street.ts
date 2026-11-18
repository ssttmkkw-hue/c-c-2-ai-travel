/**
 * 街道家具。原点底部中心，正面朝 +Z。
 * 部件数 2~6（≤15）。
 */
import type * as THREE from 'three';
import type { Palette } from '@/render/palette';
import { pick } from '@/render/palette';
import * as kit from '@/art/kit';
import { COLORS } from '@/art/colors';

function v(variant = 0): number {
  return ((variant % 3) + 3) % 3;
}

/** 路灯。高 3.2~4.2m。部件 4。 */
export function streetLamp(p: Palette, variant = 0): THREE.Group {
  const i = v(variant);
  const h = 3.2 + i * 0.5;
  const glow = pick(p.accent, i);
  return kit.group(
    kit.cylinder(0.08, 0.1, h, COLORS.metalDark, { y: h / 2, segments: 6 }),
    kit.box(0.7, 0.08, 0.08, COLORS.metal, { x: 0.28, y: h - 0.05 }),
    kit.box(0.28, 0.16, 0.28, COLORS.metal, { x: 0.55, y: h - 0.18 }),
    kit.box(0.18, 0.1, 0.18, glow, {
      x: 0.55, y: h - 0.32, emissive: glow, emissiveIntensity: 0.7, outline: false,
    }),
  );
}

/** 长椅。宽约 1.6m，高 0.9m。部件 4。 */
export function bench(p: Palette, variant = 0): THREE.Group {
  const i = v(variant);
  const wood = i === 2 ? COLORS.woodDark : COLORS.wood;
  const seat = pick(p.primary, i);
  return kit.group(
    kit.box(1.6, 0.1, 0.48, i === 0 ? wood : seat, { y: 0.48 }),
    kit.box(1.6, 0.45, 0.08, wood, { y: 0.72, z: 0.2 }),
    kit.box(0.1, 0.48, 0.48, COLORS.metal, { x: -0.7, y: 0.24 }),
    kit.box(0.1, 0.48, 0.48, COLORS.metal, { x: 0.7, y: 0.24 }),
  );
}

/** 垃圾桶。高约 1m。部件 3。 */
export function trashBin(p: Palette, variant = 0): THREE.Group {
  const i = v(variant);
  const body = i === 1 ? COLORS.metal : pick(p.primary, i);
  return kit.group(
    kit.cylinder(0.32, 0.28, 0.85, body, { y: 0.42, segments: 8 }),
    kit.cylinder(0.34, 0.34, 0.08, COLORS.metalDark, { y: 0.88, segments: 8 }),
    kit.box(0.22, 0.06, 0.04, pick(p.accent, i), { y: 0.5, z: 0.3, outline: false }),
  );
}

/** 自动售货机。约 1×1.9×0.7m。部件 5。 */
export function vendingMachine(p: Palette, variant = 0): THREE.Group {
  const i = v(variant);
  const body = pick(p.primary, i);
  const glass = pick(p.accent, i);
  return kit.group(
    kit.box(0.95, 1.85, 0.65, body, { y: 0.92 }),
    kit.box(0.7, 0.9, 0.04, COLORS.glass, { y: 1.15, z: 0.34, outline: false, opacity: 0.85, transparent: true }),
    kit.box(0.7, 0.12, 0.05, glass, { y: 1.7, z: 0.34, emissive: glass, emissiveIntensity: 0.45, outline: false }),
    kit.box(0.18, 0.35, 0.05, COLORS.metalDark, { x: 0.32, y: 0.7, z: 0.34, outline: false }),
    kit.box(1.05, 0.08, 0.72, COLORS.metal, { y: 1.88 }),
  );
}

/** 邮筒。高约 1.15m。部件 3。 */
export function postbox(p: Palette, variant = 0): THREE.Group {
  const i = v(variant);
  const body = pick(p.accent, i);
  return kit.group(
    kit.cylinder(0.28, 0.28, 0.85, body, { y: 0.55, segments: 8 }),
    kit.cylinder(0.32, 0.22, 0.28, body, { y: 1.05, segments: 8 }),
    kit.box(0.16, 0.06, 0.04, COLORS.white, { y: 0.7, z: 0.28, outline: false }),
  );
}

/** 交通锥。高约 0.7m。部件 2。 */
export function trafficCone(p: Palette, variant = 0): THREE.Group {
  const i = v(variant);
  const c = pick(p.accent, i);
  return kit.group(
    kit.cone(0.18 + i * 0.02, 0.65, 6, c, { y: 0.38 }),
    kit.cylinder(0.2, 0.2, 0.06, COLORS.white, { y: 0.06, segments: 6 }),
  );
}

/**
 * 栅栏段。长度（米）沿 X。高约 1m。部件 4。
 * variant 切换木 / 金属配色。
 */
export function fenceSegment(p: Palette, length = 2, variant = 0): THREE.Group {
  const i = v(variant);
  const len = Math.max(0.8, length);
  const post = i === 1 ? COLORS.metalDark : COLORS.woodDark;
  const rail = i === 1 ? COLORS.metal : i === 2 ? pick(p.primary, 0) : COLORS.wood;
  return kit.group(
    kit.box(0.1, 1, 0.1, post, { x: -len / 2, y: 0.5 }),
    kit.box(0.1, 1, 0.1, post, { x: len / 2, y: 0.5 }),
    kit.box(len, 0.08, 0.06, rail, { y: 0.78 }),
    kit.box(len, 0.08, 0.06, rail, { y: 0.38 }),
  );
}

/**
 * 石灯笼。高约 1.7~1.9m。部件 5。火窗朝 +Z。神社参道、庭院。
 */
export function stoneLantern(p: Palette, variant = 0): THREE.Group {
  const i = v(variant);
  const glow = pick(p.accent, 2);
  const postH = 0.58 + i * 0.1;
  const chamberY = 0.28 + postH + 0.18;
  return kit.group(
    kit.box(0.5, 0.22, 0.5, COLORS.stoneDark, { y: 0.11 }),
    kit.cylinder(0.09, 0.13, postH, COLORS.stone, { y: 0.22 + postH / 2, segments: 6 }),
    kit.box(0.4, 0.36, 0.4, COLORS.stoneLight, { y: chamberY }),
    kit.box(0.16, 0.14, 0.04, glow, {
      y: chamberY, z: 0.21, emissive: glow, emissiveIntensity: 0.7, outline: false,
    }),
    kit.cone(0.38, 0.32, 4, COLORS.stone, { y: chamberY + 0.32, ry: Math.PI / 4 }),
  );
}

/**
 * 电线杆。高约 5.6~6.2m。部件 4。横担沿 X，挂线高度约 5.2m（variant 0）。
 * 适合城市街道。
 */
export function utilityPole(p: Palette, variant = 0): THREE.Group {
  const i = v(variant);
  const h = 5.6 + i * 0.3;
  return kit.group(
    kit.cylinder(0.09, 0.13, h, COLORS.woodDark, { y: h / 2, segments: 6 }),
    kit.box(1.35, 0.08, 0.1, COLORS.wood, { y: h - 0.4 }),
    kit.box(0.08, 0.08, 0.55, COLORS.wood, { y: h - 0.72 }),
    kit.box(0.32, 0.36, 0.26, pick(p.primary, i + 2), { y: h * 0.55 }),
  );
}

/**
 * 纸灯笼（居酒屋）。含挂绳总高约 0.85m。部件 4。
 * 子节点名为 `sway`，绕其原点（挂钩）摇晃；整组原点在灯笼底部。
 */
export function paperLantern(p: Palette, variant = 0): THREE.Group {
  const i = v(variant);
  const color = pick(p.accent, i === 1 ? 3 : 0);
  const sway = kit.group(
    kit.cylinder(0.012, 0.012, 0.22, COLORS.woodDark, { y: -0.1, segments: 4, outline: false, shadow: false }),
    kit.cylinder(0.14, 0.18, 0.08, color, { y: -0.24, segments: 6 }),
    kit.cylinder(0.18, 0.18, 0.26, color, {
      y: -0.4, segments: 8, emissive: color, emissiveIntensity: 0.65,
    }),
    kit.cylinder(0.14, 0.18, 0.08, color, { y: -0.56, segments: 6 }),
  );
  sway.name = 'sway';
  sway.position.y = 0.82;
  const root = kit.group(sway);
  return root;
}
