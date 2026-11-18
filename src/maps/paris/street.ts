/**
 * 林荫大道：奥斯曼公寓（奶油墙、灰蓝斜顶、铁阳台）、咖啡馆红棚、梧桐和复古路灯。
 * 门、窗、棚都朝本地 +Z，摆放时再转向路心。
 */
import * as THREE from 'three';
import type { MapBuildContext } from '@/world/MapCard';
import * as kit from '@/art/kit';
import { COLORS } from '@/art/colors';
import { bench, bush, flowerPatch, planeTree, vintageLamp } from '@/art/props';

type Add = MapBuildContext['add'];

/** 三层公寓。宽约 7.2m，檐口约 7.2m，加上斜顶约 9m。部件 11。 */
function haussmann(p: MapBuildContext['palette'], variant: number): THREE.Group {
  const i = ((variant % 3) + 3) % 3;
  const w = 7.2 + (i === 1 ? 0.9 : 0);
  const d = 5.2;
  const story = 2.4;
  const h = story * 3;
  const roofH = 1.7;
  const wall = p.primary[i];
  const roof = i === 0 ? p.primary[3] : p.primary[4];
  const front = d / 2 + 0.04;
  return kit.group(
    kit.box(w, h, d, wall, { y: h / 2 }),
    kit.box(0.86, 1.85, 0.08, COLORS.woodDark, { x: -w * 0.28, y: 0.92, z: front, outline: false }),
    kit.box(w * 0.36, 1.05, 0.06, COLORS.glass, { x: w * 0.16, y: 1.4, z: front, outline: false }),
    kit.box(w * 0.68, 1.12, 0.06, COLORS.glass, { y: 1.35 + story, z: front, outline: false }),
    kit.box(w * 0.68, 1.12, 0.06, COLORS.glass, { y: 1.35 + story * 2, z: front, outline: false }),
    kit.box(w * 0.52, 0.1, 0.72, p.primary[2], { y: story + 0.06, z: d / 2 + 0.32 }),
    kit.box(w * 0.52, 0.32, 0.08, COLORS.metal, { y: story + 0.32, z: d / 2 + 0.64 }),
    kit.box(w + 0.28, 0.22, d + 0.22, p.primary[Math.min(i + 1, 2)], { y: h - 0.04 }),
    kit.prism(w + 0.55, roofH, d + 0.4, roof, { y: h + roofH / 2 }),
    kit.box(0.4, 0.72, 0.4, p.primary[2], { x: w * 0.26, y: h + roofH * 0.7 }),
    kit.box(0.32, 0.55, 0.32, p.primary[1], { x: -w * 0.2, y: h + roofH * 0.58 }),
  );
}

/** 街角咖啡馆。红棚斜搭在门脸上，灰蓝斜顶和公寓同一套。部件 7。 */
function createCafe(p: MapBuildContext['palette']): THREE.Group {
  const w = 6.4;
  const d = 4.5;
  const h = 3.3;
  const roofH = 1.35;
  return kit.group(
    kit.box(w, h, d, p.primary[0], { y: h / 2 }),
    kit.box(w * 0.5, 1.15, 0.06, COLORS.glass, {
      x: 0.55, y: 1.45, z: d / 2 + 0.04,
      outline: false,
      emissive: p.accent[1],
      emissiveIntensity: 0.35,
    }),
    kit.box(0.9, 1.9, 0.08, COLORS.woodDark, {
      x: -w * 0.3, y: 0.95, z: d / 2 + 0.05, outline: false,
    }),
    kit.box(w * 0.48, 0.2, 0.06, p.accent[1], { y: 2.85, z: d / 2 + 0.06, outline: false }),
    kit.box(w + 0.4, 0.08, 1.75, p.accent[0], { y: 2.42, z: d / 2 + 0.82, rx: 0.2 }),
    kit.prism(w + 0.4, roofH, d + 0.35, p.primary[3], { y: h + roofH / 2 }),
    kit.box(0.36, 0.55, 0.36, p.primary[2], { x: w * 0.22, y: h + roofH * 0.62 }),
  );
}

function bistroTable(): THREE.Group {
  return kit.group(
    kit.cylinder(0.06, 0.08, 0.74, COLORS.metalDark, { y: 0.37, segments: 6 }),
    kit.cylinder(0.46, 0.46, 0.06, COLORS.white, { y: 0.76, segments: 8 }),
  );
}

/** 小圆椅。靠背在本地 -Z，座位朝 +Z。 */
function bistroChair(p: MapBuildContext['palette']): THREE.Group {
  return kit.group(
    kit.cylinder(0.04, 0.05, 0.46, COLORS.metal, { y: 0.23, segments: 6 }),
    kit.cylinder(0.18, 0.18, 0.06, p.accent[0], { y: 0.5, segments: 6 }),
    kit.box(0.32, 0.36, 0.06, p.accent[0], { y: 0.74, z: -0.14 }),
  );
}

/** 公寓、咖啡馆、行道树、路灯、石板路。 */
export function buildStreet(ctx: MapBuildContext, add: Add): void {
  const p = ctx.palette;

  for (let i = 0; i < 6; i++) {
    const z = 20 - i * 5.2;
    add(kit.box(4.8, 0.07, 4.7, i % 2 === 0 ? COLORS.stoneLight : COLORS.stone, {
      y: 0.05, z, outline: false, shadow: false,
    }));
  }
  add(kit.box(16, 0.06, 12, COLORS.stone, {
    y: 0.04, z: -29, outline: false, shadow: false,
  }));

  const blocks: Array<[number, number, number, number]> = [
    [16.4, 21.2, Math.PI / 2, 0],
    [16.4, 1.4, Math.PI / 2, 1],
    [-16.4, 18.6, -Math.PI / 2, 1],
    [-16.4, 5.2, -Math.PI / 2, 2],
    [-17.8, -4.6, -Math.PI / 2, 0],
    [-18, 35.4, Math.PI, 0],
    [0, 35.8, Math.PI, 1],
    [18, 35.4, Math.PI, 2],
    [-18, -39.4, 0, 2],
    [18, -39.4, 0, 0],
    [31.2, 16, Math.PI / 2, 1],
    [31.2, -28, Math.PI / 2, 0],
    [-31.2, 14, -Math.PI / 2, 2],
    [-31.2, -28, -Math.PI / 2, 1],
  ];
  for (const [x, z, ry, variant] of blocks) {
    add(kit.place(haussmann(p, variant), x, z, ry), { collide: true });
  }

  add(kit.place(createCafe(p), 12.6, 11.2, Math.PI / 2));
  // 棚子伸到人行道上，碰撞只包墙身，免得露台变成一堵空气墙。
  // ry = PI/2：本地 +Z 转到世界 -X，门朝大道。
  ctx.addCollider(new THREE.Box3(
    new THREE.Vector3(10.3, 0, 7.9),
    new THREE.Vector3(15.0, 5.2, 14.5),
  ));

  const tables: Array<[number, number]> = [[7.4, 8.7], [7.4, 11.6], [7.4, 14.4]];
  for (const [x, z] of tables) add(kit.place(bistroTable(), x, z));
  add(kit.place(bistroChair(p), 7.4, 7.9, 0));
  add(kit.place(bistroChair(p), 7.4, 9.5, Math.PI));
  add(kit.place(bistroChair(p), 6.5, 11.6, -Math.PI / 2));
  add(kit.place(bistroChair(p), 8.3, 11.6, Math.PI / 2));
  add(kit.place(bistroChair(p), 7.4, 13.6, 0));
  add(kit.place(bistroChair(p), 7.4, 15.2, Math.PI));

  const trees: Array<[number, number, number]> = [
    [9.6, 17.2, 0], [10.2, 5.6, 1], [9.6, -3.2, 2],
    [-9.4, 15.2, 1], [-9.4, 1.2, 2], [-10.2, -6.2, 0],
    [14.5, -27.5, 0], [-14.5, -27.5, 2],
    [24, -30, 1], [-24, -30, 0],
    [23, -23.5, 2], [-23, -23.5, 1],
    [-28, 24, 0], [28, 26, 1],
    [-34, 0, 2], [34, -2, 0],
  ];
  for (const [x, z, variant] of trees) {
    add(kit.place(planeTree(p, variant), x, z));
    ctx.addCollider(new THREE.Box3(
      new THREE.Vector3(x - 0.24, 0, z - 0.24),
      new THREE.Vector3(x + 0.24, 2.2, z + 0.24),
    ));
  }

  const lamps: Array<[number, number]> = [
    [5.5, 16.5], [-5.5, 12.5], [5.5, 3.2], [-5.5, -1.5],
    [5.2, -8.2], [-5.2, -8.2], [5.4, -24.5], [-5.4, -24.5],
  ];
  for (const [x, z] of lamps) {
    add(kit.place(vintageLamp(p, 1), x, z), { collide: true });
  }

  add(kit.place(bench(p, 0), -13.4, -6.5, 0));
  add(kit.place(bench(p, 1), 17.6, -7.2, 0));
  add(kit.place(flowerPatch(p, 0), 5.8, 8.2));
  add(kit.place(flowerPatch(p, 1), -6.2, 6.4));
  add(kit.place(flowerPatch(p, 2), 4.6, -6.8));
  add(kit.place(bush(p, 0), 14.8, 7.2));
  add(kit.place(bush(p, 1), -14.2, 8.6));
  add(kit.place(bush(p, 2), 20, -26));
  add(kit.place(bush(p, 0), -20, -25));
}
