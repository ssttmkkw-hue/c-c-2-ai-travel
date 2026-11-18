/**
 * 街道家具。原点底部中心，正面朝 -Z。
 * 部件数 2~5（≤15）。
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
