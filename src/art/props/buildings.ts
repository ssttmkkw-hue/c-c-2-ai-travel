/**
 * 通用建筑。原点底部中心，门朝 -Z。
 * 房子 / 店铺 / 塔部件数均 ≤ 40（实际约 6~14）。
 * 人字顶用两块斜板拼出，没有三棱柱基础件。
 */
import type * as THREE from 'three';
import type { Palette } from '@/render/palette';
import { pick } from '@/render/palette';
import * as kit from '@/art/kit';
import { COLORS } from '@/art/colors';

export interface HouseOpts {
  w?: number;
  d?: number;
  floors?: number;
  roof?: 'gable' | 'flat' | 'hip';
}

function vi(variant = 0): number {
  return ((variant % 3) + 3) % 3;
}

/**
 * 通用房子。默认 6×5m、2 层、人字顶。层高 2.4m（Q 版偏矮）。
 * 部件：墙 + 门 + 每层 2 扇窗 + 屋顶 1~2 + 可选烟囱。最多约 11。
 */
export function house(p: Palette, opts: HouseOpts = {}, variant = 0): THREE.Group {
  const i = vi(variant);
  const w = opts.w ?? 6;
  const d = opts.d ?? 5;
  const floors = Math.max(1, Math.min(4, opts.floors ?? 2));
  const roof = opts.roof ?? 'gable';
  const story = 2.4;
  const h = floors * story;
  const wall = pick(p.primary, i);
  const parts: THREE.Object3D[] = [
    kit.box(w, h, d, wall, { y: h / 2 }),
    kit.box(0.9, 1.8, 0.08, COLORS.woodDark, { y: 0.9, z: d / 2 + 0.02, outline: false }),
  ];
  for (let f = 0; f < floors; f++) {
    const y = 1.35 + f * story;
    const win = COLORS.glass;
    parts.push(
      kit.box(0.7, 0.7, 0.06, win, { x: -w * 0.25, y, z: d / 2 + 0.04, outline: false }),
      kit.box(0.7, 0.7, 0.06, win, { x: w * 0.25, y, z: d / 2 + 0.04, outline: false }),
    );
  }
  const roofColor = pick(p.accent, i);
  if (roof === 'flat') {
    parts.push(kit.box(w + 0.4, 0.25, d + 0.4, roofColor, { y: h + 0.12 }));
  } else if (roof === 'hip') {
    parts.push(kit.cone(Math.max(w, d) * 0.72, 1.6, 4, roofColor, { y: h + 0.8, ry: Math.PI / 4 }));
  } else {
    const slope = 0.55;
    parts.push(
      kit.box(w + 0.3, 0.16, d * 0.72, roofColor, { y: h + 0.55, z: -d * 0.16, rx: slope }),
      kit.box(w + 0.3, 0.16, d * 0.72, roofColor, { y: h + 0.55, z: d * 0.16, rx: -slope }),
    );
  }
  if (i === 2) parts.push(kit.box(0.4, 0.7, 0.4, COLORS.stoneDark, { x: w * 0.28, y: h + 0.5 }));
  return kit.group(...parts);
}

/** 一层店铺。宽默认 5m。部件 6。招牌色可传入，否则按 variant 取 accent。 */
export function shopfront(p: Palette, opts: { w?: number; signColor?: string } = {}, variant = 0): THREE.Group {
  const i = vi(variant);
  const w = opts.w ?? 5;
  const sign = opts.signColor ?? pick(p.accent, i);
  const h = 3.2;
  return kit.group(
    kit.box(w, h, 4, pick(p.primary, i), { y: h / 2 }),
    kit.box(w + 0.4, 0.12, 1.3, sign, { y: 2.5, z: 2.35 }),
    kit.box(w * 0.7, 0.45, 0.08, sign, {
      y: 2.9, z: 2.08, emissive: sign, emissiveIntensity: 0.55, outline: false,
    }),
    kit.box(w * 0.62, 1.3, 0.06, COLORS.glass, { y: 1.35, z: 2.06, outline: false, transparent: true, opacity: 0.8 }),
    kit.box(0.9, 1.9, 0.08, COLORS.woodDark, { x: w * 0.32, y: 0.95, z: 2.06, outline: false }),
    kit.box(w + 0.2, 0.15, 4.3, pick(p.primary, i + 1), { y: h + 0.08 }),
  );
}

/** 细高楼（城市远景）。层高 2.2m。部件：楼身 + 顶 + 每层一条窗带（≤8 层）。最多约 11。 */
export function tower(p: Palette, opts: { floors?: number } = {}, variant = 0): THREE.Group {
  const i = vi(variant);
  const floors = Math.max(3, Math.min(8, opts.floors ?? 5 + i));
  const story = 2.2;
  const h = floors * story;
  const w = 3.2;
  const parts: THREE.Object3D[] = [
    kit.box(w, h, w, pick(p.primary, i), { y: h / 2 }),
    kit.box(w + 0.3, 0.3, w + 0.3, pick(p.primary, i + 1), { y: h + 0.15 }),
    kit.box(0.3, 0.8, 0.3, COLORS.metalDark, { y: h + 0.7 }),
  ];
  for (let f = 0; f < floors; f++) {
    parts.push(kit.box(w + 0.04, 0.35, 0.06, COLORS.glass, {
      y: 1.2 + f * story, z: w / 2 + 0.02, outline: false,
    }));
  }
  return kit.group(...parts);
}
