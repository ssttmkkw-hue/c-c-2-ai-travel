/**
 * 塞纳河：东西向的一段河、正中石桥、南岸绿色书报摊、鸽子。
 * 河面碰撞在桥洞两侧断开，人从桥上走到铁塔前的广场。
 */
import * as THREE from 'three';
import type { MapBuildContext } from '@/world/MapCard';
import * as kit from '@/art/kit';
import { COLORS } from '@/art/colors';

type Add = MapBuildContext['add'];

export interface Flyer {
  root: THREE.Object3D;
  wingL: THREE.Object3D;
  wingR: THREE.Object3D;
  phase: number;
  radius: number;
}

export interface Pecker {
  root: THREE.Object3D;
  phase: number;
}

export interface QuayAnim {
  waves: THREE.Object3D[];
  flyers: Flyer[];
  peckers: Pecker[];
}

const RIVER_Z = -16;
const WATER_HALF_Z = 5.2;

/** 绿色书报摊。箱盖朝 +Z 掀开。宽约 1.8m。部件 5。 */
function bookstall(p: MapBuildContext['palette'], variant: number): THREE.Group {
  const green = variant % 2 === 0 ? p.foliage[1] : p.foliage[0];
  return kit.group(
    kit.box(1.7, 0.95, 0.62, green, { y: 0.58 }),
    kit.box(1.78, 0.08, 0.7, p.foliage[0], { y: 1.08 }),
    kit.box(1.84, 0.07, 0.9, green, { y: 1.42, z: 0.28, rx: -0.65 }),
    kit.box(1.15, 0.22, 0.06, COLORS.woodLight, { y: 1.22, z: 0.36, outline: false }),
    kit.box(0.42, 0.18, 0.05, p.accent[variant % 2 === 0 ? 1 : 0], {
      x: 0.45, y: 1.28, z: 0.38, outline: false,
    }),
  );
}

function createPigeon(): { root: THREE.Group; wingL: THREE.Mesh; wingR: THREE.Mesh } {
  const wingL = kit.box(0.42, 0.07, 0.22, COLORS.stone, { x: -0.28, y: 0.2 });
  const wingR = kit.box(0.42, 0.07, 0.22, COLORS.stone, { x: 0.28, y: 0.2 });
  const root = kit.group(
    kit.ball(0.18, COLORS.stoneLight, { y: 0.2 }),
    kit.cone(0.05, 0.12, 4, COLORS.stoneDark, { y: 0.2, z: 0.2, rx: Math.PI / 2 }),
    wingL,
    wingR,
  );
  return { root, wingL, wingR };
}

/** 低石桥。桥面贴地（不能站到物体上），栏杆单独做碰撞。长沿 Z。 */
function createBridge(p: MapBuildContext['palette']): THREE.Group {
  return kit.group(
    kit.box(7.4, 0.16, 12.6, COLORS.stone, { y: 0.1, outline: false, shadow: false }),
    kit.box(0.4, 0.7, 12.2, COLORS.stoneLight, { x: -3.15, y: 0.48 }),
    kit.box(0.4, 0.7, 12.2, COLORS.stoneLight, { x: 3.15, y: 0.48 }),
    kit.box(0.72, 0.95, 0.72, COLORS.stoneDark, { x: -3.15, y: 0.48, z: -5.7 }),
    kit.box(0.72, 0.95, 0.72, COLORS.stoneDark, { x: 3.15, y: 0.48, z: -5.7 }),
    kit.box(0.72, 0.95, 0.72, COLORS.stoneDark, { x: -3.15, y: 0.48, z: 5.7 }),
    kit.box(0.72, 0.95, 0.72, COLORS.stoneDark, { x: 3.15, y: 0.48, z: 5.7 }),
    kit.box(0.34, 0.26, 0.28, p.accent[1], { y: 0.96, z: 6.05 }),
  );
}

export function buildQuay(ctx: MapBuildContext, add: Add): QuayAnim {
  const p = ctx.palette;

  const water = kit.group(
    kit.box(86, 0.12, WATER_HALF_Z * 2, p.accent[2], {
      y: 0.06, outline: false, shadow: false,
    }),
  );
  const waves: THREE.Object3D[] = [];
  for (let i = 0; i < 4; i++) {
    const wave = kit.box(14, 0.04, 3.2, p.sky, {
      y: 0.14,
      x: -30 + i * 18,
      outline: false,
      shadow: false,
      transparent: true,
      opacity: 0.45,
    });
    water.add(wave);
    waves.push(wave);
  }
  add(kit.place(water, 0, RIVER_Z));

  const bank = RIVER_Z + WATER_HALF_Z;
  const far = RIVER_Z - WATER_HALF_Z;
  ctx.addCollider(new THREE.Box3(
    new THREE.Vector3(-43, 0, far),
    new THREE.Vector3(-3.6, 1.2, bank),
  ));
  ctx.addCollider(new THREE.Box3(
    new THREE.Vector3(3.6, 0, far),
    new THREE.Vector3(43, 1.2, bank),
  ));

  // 石岸在桥洞两侧断开，内缘贴着栏杆，外缘埋进两侧围墙。
  add(kit.box(39.6, 0.48, 0.7, COLORS.stone, { x: -23.2, y: 0.28, z: bank + 0.2 }), { collide: true });
  add(kit.box(39.6, 0.48, 0.7, COLORS.stone, { x: 23.2, y: 0.28, z: bank + 0.2 }), { collide: true });
  add(kit.box(39.6, 0.48, 0.7, COLORS.stoneDark, { x: -23.2, y: 0.28, z: far - 0.25 }), { collide: true });
  add(kit.box(39.6, 0.48, 0.7, COLORS.stoneDark, { x: 23.2, y: 0.28, z: far - 0.25 }), { collide: true });

  add(kit.place(createBridge(p), 0, RIVER_Z));
  ctx.addCollider(new THREE.Box3(
    new THREE.Vector3(-3.5, 0, RIVER_Z - 6.2),
    new THREE.Vector3(-2.8, 1.15, RIVER_Z + 6.2),
  ));
  ctx.addCollider(new THREE.Box3(
    new THREE.Vector3(2.8, 0, RIVER_Z - 6.2),
    new THREE.Vector3(3.5, 1.15, RIVER_Z + 6.2),
  ));

  const stalls: Array<[number, number, number]> = [
    [-12.4, -8.7, 0],
    [-8.2, -8.7, 1],
    [9.6, -8.7, 0],
    [13.6, -8.7, 1],
  ];
  for (const [x, z, variant] of stalls) {
    add(kit.place(bookstall(p, variant), x, z), { collide: true });
  }

  const barge = kit.group(
    kit.box(6.4, 0.48, 1.7, p.primary[2], { y: 0.32 }),
    kit.box(2.1, 0.7, 1.35, p.primary[0], { y: 0.78, x: -0.8 }),
    kit.box(1.3, 0.28, 1.45, p.accent[0], { y: 1.2, x: -0.8 }),
    kit.cylinder(0.04, 0.04, 0.9, COLORS.metalDark, { y: 1.15, x: 2.1, segments: 4 }),
  );
  add(kit.place(barge, 20, RIVER_Z, Math.PI / 2, 0.02));

  const flyers: Flyer[] = [];
  for (let i = 0; i < 3; i++) {
    const bird = createPigeon();
    const phase = i * 2.09;
    const radius = 3.6;
    bird.root.position.set(Math.cos(phase) * radius, 5.5, 7 + Math.sin(phase) * radius * 0.65);
    add(bird.root);
    flyers.push({ root: bird.root, wingL: bird.wingL, wingR: bird.wingR, phase, radius });
  }

  const peckers: Pecker[] = [];
  for (const [x, z, phase] of [[-6.4, -7.6, 0.4], [4.2, -7.2, 1.7], [2.4, 6.5, 2.4]] as Array<[number, number, number]>) {
    const bird = createPigeon();
    add(kit.place(bird.root, x, z));
    peckers.push({ root: bird.root, phase });
  }

  return { waves, flyers, peckers };
}
