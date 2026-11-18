/**
 * 东侧集市（帐篷、陶罐、地毯、骆驼）和西侧尼罗河（河面、芦苇、三角帆船）。
 * 摊位正面朝 +Z，摆放时再转向路心。
 */
import * as THREE from 'three';
import type { MapBuildContext } from '@/world/MapCard';
import { pick } from '@/render/palette';
import * as kit from '@/art/kit';
import { COLORS } from '@/art/colors';
import { palmTree, bush } from '@/art/props';

type Add = MapBuildContext['add'];

export interface SouqAnim {
  camelHead: THREE.Object3D;
  sail: THREE.Object3D;
}

/** 布棚摊：四柱、三棱棚顶、柜台、地毯、陶罐。宽约 2.8m。 */
function createStall(p: MapBuildContext['palette'], variant: number): THREE.Group {
  const cloth = pick(p.accent, variant);
  const trim = pick(p.primary, variant + 1);
  return kit.group(
    kit.cylinder(0.06, 0.07, 2.15, COLORS.wood, { x: -1.25, y: 1.08, z: 0.85, segments: 6 }),
    kit.cylinder(0.06, 0.07, 2.15, COLORS.wood, { x: 1.25, y: 1.08, z: 0.85, segments: 6 }),
    kit.cylinder(0.06, 0.07, 2.15, COLORS.wood, { x: -1.25, y: 1.08, z: -0.85, segments: 6 }),
    kit.cylinder(0.06, 0.07, 2.15, COLORS.wood, { x: 1.25, y: 1.08, z: -0.85, segments: 6 }),
    kit.prism(2.9, 0.72, 2.15, cloth, { y: 2.4 }),
    kit.box(2.7, 0.22, 0.06, trim, { y: 2.02, z: 1.02, outline: false }),
    kit.box(2.3, 0.72, 0.85, COLORS.wood, { y: 0.38, z: 0.05 }),
    kit.box(2.15, 0.04, 1.45, pick(p.accent, variant + 1), { y: 0.03, z: 1.45, outline: false, shadow: false }),
    kit.box(1.5, 0.03, 0.9, pick(p.accent, variant + 2), { y: 0.055, z: 1.35, outline: false, shadow: false }),
    kit.cylinder(0.22, 0.15, 0.38, p.accent[1], { x: -0.55, y: 0.92, z: 0.08, segments: 6 }),
    kit.cylinder(0.16, 0.11, 0.3, p.primary[2], { x: 0.45, y: 0.88, z: 0.12, segments: 6 }),
    kit.ball(0.16, p.accent[1], { x: 0.05, y: 0.84, z: -0.15 }),
  );
}

/** 骆驼。头单独成组，方便慢慢点头。侧面最容易认出驼峰。 */
function createCamel(p: MapBuildContext['palette']): { root: THREE.Group; head: THREE.Group } {
  const hide = COLORS.woodLight;
  const dark = COLORS.wood;
  const head = kit.group(
    kit.box(0.34, 0.26, 0.58, hide, { y: 0.02, z: 0.12 }),
    kit.box(0.2, 0.14, 0.26, dark, { y: -0.02, z: 0.42 }),
    kit.cone(0.07, 0.2, 4, dark, { x: -0.12, y: 0.2, z: 0.02 }),
    kit.cone(0.07, 0.2, 4, dark, { x: 0.12, y: 0.2, z: 0.02 }),
  );
  head.position.set(0, 1.7, 0.92);
  const root = kit.group(
    kit.box(1.4, 0.58, 0.52, hide, { y: 1.02 }),
    kit.ball(0.34, hide, { y: 1.4, z: -0.08 }),
    kit.box(0.7, 0.08, 0.58, p.accent[1], { y: 1.28 }),
    kit.box(0.18, 0.5, 0.18, hide, { y: 1.42, z: 0.52, rx: -0.5 }),
    kit.cylinder(0.07, 0.09, 0.92, hide, { x: -0.4, y: 0.46, z: 0.28, segments: 6 }),
    kit.cylinder(0.07, 0.09, 0.92, hide, { x: 0.4, y: 0.46, z: 0.28, segments: 6 }),
    kit.cylinder(0.07, 0.09, 0.92, hide, { x: -0.4, y: 0.46, z: -0.36, segments: 6 }),
    kit.cylinder(0.07, 0.09, 0.92, hide, { x: 0.4, y: 0.46, z: -0.36, segments: 6 }),
    head,
    kit.cylinder(0.05, 0.04, 0.45, dark, { y: 1.05, z: -0.78, rx: 0.7, segments: 6 }),
  );
  return { root, head };
}

/** 三角帆船。帆是薄三棱柱，绕桅杆轻摆。 */
function createFelucca(p: MapBuildContext['palette']): { root: THREE.Group; sail: THREE.Group } {
  const sail = kit.group(
    kit.prism(0.07, 2.35, 1.65, p.primary[0], { y: 1.05, x: 0.2 }),
  );
  sail.position.set(0, 1.85, -0.05);
  const root = kit.group(
    kit.box(0.95, 0.36, 3.3, COLORS.wood, { y: 0.26 }),
    kit.box(0.55, 0.16, 2.3, p.primary[1], { y: 0.48 }),
    kit.box(0.4, 0.28, 0.5, COLORS.woodDark, { y: 0.58, z: 1.15 }),
    kit.cylinder(0.05, 0.07, 3.15, COLORS.woodDark, { y: 1.75, z: -0.1, segments: 6 }),
    kit.box(0.08, 0.08, 1.7, COLORS.wood, { y: 2.05, z: 0.35 }),
    sail,
  );
  return { root, sail };
}

function createReed(p: MapBuildContext['palette'], variant: number): THREE.Group {
  const c = pick(p.foliage, variant);
  return kit.group(
    kit.box(0.08, 1.15, 0.08, c, { y: 0.58, rz: 0.12, outline: false }),
    kit.box(0.08, 1.35, 0.08, pick(p.foliage, variant + 1), { x: 0.16, y: 0.66, rz: -0.18, outline: false }),
    kit.box(0.07, 0.95, 0.07, c, { x: -0.14, z: 0.08, y: 0.48, rz: 0.2, outline: false }),
  );
}

/**
 * 河在西、集市在东。河面碰撞挡住下河，码头石沿再挡一层。
 * 返回需要每帧轻动的驼头和帆。河面本身用着色器动，不用再推波纹盒子。
 */
export function buildSouq(ctx: MapBuildContext, add: Add): SouqAnim {
  const p = ctx.palette;

  const stalls: Array<[number, number, number]> = [
    [17.4, 13.2, 0],
    [21.2, 5.4, 1],
    [17.8, -2.2, 2],
  ];
  for (const [x, z, variant] of stalls) {
    add(kit.place(createStall(p, variant), x, z, -Math.PI / 2));
    // 只挡棚柱和柜台。地毯伸向路面，不进碰撞，避免摊前多出一截空气墙。
    // ry = -PI/2：本地 +Z 转到世界 -X。
    ctx.addCollider(new THREE.Box3(
      new THREE.Vector3(x - 1.05, 0, z - 1.45),
      new THREE.Vector3(x + 1.15, 2.5, z + 1.45),
    ));
  }

  const camel = createCamel(p);
  add(kit.place(camel.root, 13.6, 9.4, 0.2), { collide: true });

  const boat = createFelucca(p);
  add(kit.place(boat.root, -31.5, 2.5, 0.18, 0.02));

  const nile = kit.waterSurface(18, 76, {
    deep: p.accent[0],
    shallow: p.sky,
    foam: COLORS.white,
    sky: p.skyTop ?? p.sky,
  }, 0.14);
  add(kit.place(nile, -31.2, -2, 0, 0.08));
  ctx.addCollider(new THREE.Box3(
    new THREE.Vector3(-40.6, 0, -40),
    new THREE.Vector3(-22.4, 1.5, 36),
  ));

  add(kit.box(1.35, 0.42, 72, COLORS.stone, { x: -21.5, y: 0.2, z: -2 }), { collide: true });
  add(kit.box(2.4, 0.08, 70, COLORS.stoneLight, {
    x: -19.6, y: 0.05, z: -2, outline: false, shadow: false,
  }));

  const reedZ = [-30, -24, -18, -12, -6, 0, 6, 12, 18, 24, 30];
  reedZ.forEach((z, i) => {
    add(kit.place(createReed(p, i), -20.15, z + (i % 2) * 0.4));
    if (i % 2 === 0) add(kit.place(createReed(p, i + 1), -38.2, z - 1.2));
  });

  const palms: Array<[number, number, number]> = [
    [-16.2, 17, 0],
    [-15.4, 7.5, 1],
    [-16.6, -1.5, 2],
    [-16.8, -6.2, 0],
    [-17.2, 24.5, 1],
    [27.2, 16.5, 2],
    [28.4, 3.5, 0],
    [26.6, -8, 1],
  ];
  for (const [x, z, variant] of palms) {
    add(kit.place(palmTree(p, variant), x, z));
    ctx.addCollider(new THREE.Box3(
      new THREE.Vector3(x - 0.2, 0, z - 0.2),
      new THREE.Vector3(x + 0.2, 2.2, z + 0.2),
    ));
  }

  add(kit.place(bush(p, 0), -17.4, 12.5));
  add(kit.place(bush(p, 1), -17.8, -8));
  add(kit.place(bush(p, 2), 24.5, 9.5));

  return { camelHead: kit.dynamic(camel.head), sail: kit.dynamic(boat.sail) };
}
