/**
 * 自然小景。原点底部中心。部件数 1~4（≤15）。
 */
import type * as THREE from 'three';
import type { Palette } from '@/render/palette';
import { pick } from '@/render/palette';
import * as kit from '@/art/kit';
import { COLORS } from '@/art/colors';

function v(variant = 0): number {
  return ((variant % 3) + 3) % 3;
}

/** 石头。variant 0 小 / 1 中 / 2 大。约 0.4 / 0.8 / 1.4m。部件 1~2。 */
export function rock(p: Palette, variant = 0): THREE.Group {
  const i = v(variant);
  const scale = [0.28, 0.5, 0.85][i] ?? 0.5;
  const color = i === 2 ? COLORS.stoneDark : i === 1 ? COLORS.stone : COLORS.stoneLight;
  const parts = [kit.ball(scale, color, { y: scale * 0.65, detail: 0 })];
  if (i > 0) {
    parts.push(kit.ball(scale * 0.55, COLORS.stone, { x: scale * 0.7, y: scale * 0.4, z: 0.1 }));
  }
  if (i < 2) {
    parts.push(kit.ball(scale * 0.35, pick(p.foliage, i), { x: -scale * 0.2, y: scale * 0.9, z: scale * 0.15, outline: false }));
  }
  return kit.group(...parts);
}

/** 草丛。高约 0.45m。部件 3。 */
export function grassTuft(p: Palette, variant = 0): THREE.Group {
  const i = v(variant);
  const c = pick(p.foliage, i);
  const h = 0.38 + i * 0.06;
  return kit.group(
    kit.box(0.14, h, 0.14, c, { y: h / 2, rz: 0.25 }),
    kit.box(0.14, h * 0.9, 0.14, pick(p.foliage, i + 1), { x: 0.16, y: h * 0.42, rz: -0.35 }),
    kit.box(0.14, h * 0.85, 0.14, c, { x: -0.14, z: 0.08, y: h * 0.4, rz: 0.2, ry: 0.4 }),
  );
}

/** 花丛。宽约 0.8m。花色用 accent。部件 4。 */
export function flowerPatch(p: Palette, variant = 0): THREE.Group {
  const i = v(variant);
  const leaf = pick(p.foliage, i);
  return kit.group(
    kit.ball(0.32, leaf, { y: 0.22 }),
    kit.ball(0.12, pick(p.accent, i), { x: -0.14, y: 0.42, z: 0.08, detail: 0, outline: false }),
    kit.ball(0.12, pick(p.accent, i + 1), { x: 0.16, y: 0.4, detail: 0, outline: false }),
    kit.ball(0.11, pick(p.accent, i), { z: -0.14, y: 0.38, detail: 0, outline: false }),
  );
}
