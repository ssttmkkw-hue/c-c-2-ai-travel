/**
 * 植物。原点在底部中心，正面朝 -Z。
 * 尺寸约 0.8~6m。部件数 2~6（≤15）。适合街道、公园、海岸。
 */
import type * as THREE from 'three';
import type { Palette } from '@/render/palette';
import { pick } from '@/render/palette';
import * as kit from '@/art/kit';
import { COLORS } from '@/art/colors';

function v(variant = 0): number {
  return ((variant % 3) + 3) % 3;
}

/** 圆冠树。高约 3.2~4.6m。部件 2~3。 */
export function roundCrownTree(p: Palette, variant = 0): THREE.Group {
  const i = v(variant);
  const h = 1.5 + i * 0.35;
  const r = 1.15 + i * 0.12;
  const parts: THREE.Object3D[] = [
    kit.cylinder(0.12, 0.2, h, COLORS.bark, { y: h / 2, segments: 6 }),
    kit.ball(r, pick(p.foliage, i), { y: h + r * 0.72 }),
  ];
  if (i === 2) parts.push(kit.ball(r * 0.72, pick(p.foliage, i + 1), { x: 0.45, y: h + r * 0.35, z: 0.2 }));
  return kit.group(...parts);
}

/** 锥形松树。高约 4.2~5.4m。部件 4。 */
export function pineTree(p: Palette, variant = 0): THREE.Group {
  const i = v(variant);
  const trunk = 0.7 + i * 0.1;
  const layer = 1.15;
  return kit.group(
    kit.cylinder(0.1, 0.18, trunk, COLORS.bark, { y: trunk / 2, segments: 6 }),
    kit.cone(1.35 - i * 0.05, layer, 6, pick(p.foliage, i), { y: trunk + layer * 0.35 }),
    kit.cone(1.05, layer, 6, pick(p.foliage, i + 1), { y: trunk + layer * 1.05 }),
    kit.cone(0.7, layer * 0.9, 6, pick(p.foliage, i), { y: trunk + layer * 1.7 }),
  );
}

/** 樱花树。花色用 COLORS.sakura。高约 3.4~4.2m。部件 3。 */
export function sakuraTree(p: Palette, variant = 0): THREE.Group {
  void p;
  const i = v(variant);
  const h = 1.4 + i * 0.2;
  const blossom = pick([...COLORS.sakura], i);
  return kit.group(
    kit.cylinder(0.1, 0.18, h, COLORS.bark, { y: h / 2, segments: 6 }),
    kit.ball(1.15 + i * 0.08, blossom, { y: h + 0.85 }),
    kit.ball(0.85, pick([...COLORS.sakura], i + 1), { x: 0.55, y: h + 0.45, z: 0.15 }),
  );
}

/** 棕榈。高约 4~5.5m。部件 6。 */
export function palmTree(p: Palette, variant = 0): THREE.Group {
  const i = v(variant);
  const h = 2.6 + i * 0.45;
  const leaf = pick(p.foliage, i);
  const crownY = h + 0.15;
  const frond = (ry: number) => {
    const dist = 0.7;
    return kit.box(0.28, 0.08, 1.35, leaf, {
      x: Math.sin(ry) * dist,
      z: Math.cos(ry) * dist,
      y: crownY,
      ry,
      rx: 0.45,
    });
  };
  return kit.group(
    kit.cylinder(0.1, 0.16, h, COLORS.bark, { y: h / 2, segments: 6 }),
    frond(0.2),
    frond(1.45),
    frond(2.7),
    frond(3.95),
    frond(5.2),
  );
}

/** 灌木。高约 0.7~1.1m。部件 2~3。 */
export function bush(p: Palette, variant = 0): THREE.Group {
  const i = v(variant);
  const r = 0.42 + i * 0.08;
  const parts: THREE.Object3D[] = [
    kit.ball(r, pick(p.foliage, i), { y: r * 0.85 }),
    kit.ball(r * 0.75, pick(p.foliage, i + 1), { x: r * 0.7, y: r * 0.6, z: 0.1 }),
  ];
  if (i === 1) parts.push(kit.ball(r * 0.6, pick(p.foliage, i), { x: -0.25, z: 0.2, y: r * 0.55 }));
  return kit.group(...parts);
}
