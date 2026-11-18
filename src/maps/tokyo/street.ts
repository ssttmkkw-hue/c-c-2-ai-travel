/**
 * 霓虹小街：面店、便利店、居酒屋、竖招牌、自动售货机、电线杆。
 * 店铺正面朝 +Z。南侧店铺用旋转朝向街心。不用真实品牌名。
 */
import * as THREE from 'three';
import type { MapBuildContext } from '@/world/MapCard';
import { pick } from '@/render/palette';
import * as kit from '@/art/kit';
import { COLORS } from '@/art/colors';
import {
  shopfront, vendingMachine, bench, trashBin, streetLamp, utilityPole, paperLantern,
} from '@/art/props';

type Add = MapBuildContext['add'];

export interface StreetAnim {
  sways: THREE.Object3D[];
  flickers: THREE.Object3D[];
}

/**
 * 竖向招牌，垂直于店面挑向街道。发光片贴在底板两侧（面朝 ±X），
 * 从街道两个方向都能看见，不会被底板包住。
 */
function verticalSign(h: number, color: string, dark: string): { root: THREE.Group; glow: THREE.Object3D } {
  const y = 0.5 + h * 0.42;
  const panel = (x: number) => kit.box(0.04, h * 0.78, 0.46, color, {
    x, y, z: 0.1, emissive: color, emissiveIntensity: 1.2, outline: false,
  });
  const glow = kit.group(panel(-0.09), panel(0.09));
  const root = kit.group(
    kit.box(0.14, h, 0.58, dark, { y: 0.4 + h / 2 }),
    glow,
  );
  return { root, glow };
}

/** 只挡店身，檐下可以走。店身深 4m，原点在底部中心。 */
function shopBody(ctx: MapBuildContext, x: number, z: number, w: number): void {
  const hw = w / 2;
  ctx.addCollider(new THREE.Box3(
    new THREE.Vector3(x - hw, 0, z - 2),
    new THREE.Vector3(x + hw, 3.4, z + 2),
  ));
}

/** 道路沿 X，中心 z ≈ 6.6，西端接参道。 */
export function buildNeonStreet(ctx: MapBuildContext, add: Add): StreetAnim {
  const p = ctx.palette;
  const sways: THREE.Object3D[] = [];
  const flickers: THREE.Object3D[] = [];

  add(kit.box(30, 0.05, 4.2, p.primary[3], { x: 20.2, y: 0.045, z: 6.6, outline: false, shadow: false }));
  add(kit.box(28, 0.04, 1.15, p.primary[1], { x: 20.5, y: 0.028, z: 3.95, outline: false, shadow: false }));
  add(kit.box(28, 0.04, 1.15, p.primary[1], { x: 20.5, y: 0.028, z: 9.25, outline: false, shadow: false }));
  add(kit.box(6.4, 0.04, 4.6, pick(p.primary, 0), {
    x: 5.4, y: 0.025, z: 6.6, outline: false, shadow: false,
  }));

  const shops: Array<{ x: number; z: number; w: number; variant: number; sign: string }> = [
    { x: 15, z: 0.15, w: 5.4, variant: 0, sign: p.accent[3] },
    { x: 23, z: 0.15, w: 5.2, variant: 1, sign: p.accent[1] },
    { x: 31, z: 0.15, w: 5.4, variant: 2, sign: p.accent[0] },
    { x: 17.5, z: 13.5, w: 5.2, variant: 2, sign: p.accent[2] },
    { x: 26.5, z: 13.5, w: 5.4, variant: 0, sign: p.accent[1] },
  ];

  for (const s of shops) {
    const facing = s.z > 6 ? Math.PI : 0;
    add(kit.place(shopfront(p, { w: s.w, signColor: s.sign }, s.variant), s.x, s.z, facing));
    shopBody(ctx, s.x, s.z, s.w);
  }

  hangNoren(add, 15, 2.35, p.accent[3]);
  add(kit.place(vendingMachine(p, 1), 21.2, 4.15), { collide: true });
  add(kit.place(vendingMachine(p, 2), 24.7, 4.15), { collide: true });

  [29.15, 30.55, 31.95].forEach((x, i) => {
    const lantern = paperLantern(p, i);
    add(kit.place(lantern, x, 2.55, 0, 1.5));
    const sway = lantern.getObjectByName('sway');
    if (sway) sways.push(sway);
  });

  const signs: Array<{ x: number; z: number; h: number; color: string; ry?: number; flicker?: boolean }> = [
    { x: 12.15, z: 2.55, h: 2.5, color: p.accent[3] },
    { x: 19.05, z: 2.6, h: 3.0, color: p.accent[1], flicker: true },
    { x: 27.05, z: 2.6, h: 2.3, color: p.accent[0] },
    { x: 34.15, z: 2.7, h: 3.2, color: p.accent[3], flicker: true },
    { x: 10.6, z: 3.55, h: 4.6, color: p.accent[0], flicker: true },
    { x: 10.6, z: 9.7, h: 3.5, color: p.accent[1] },
    { x: 14.6, z: 10.7, h: 2.4, color: p.accent[2], ry: Math.PI },
  ];
  for (const s of signs) {
    const made = verticalSign(s.h, s.color, p.outline);
    add(kit.place(made.root, s.x, s.z, s.ry ?? 0), { collide: true });
    if (s.flicker) flickers.push(made.glow);
  }

  // 街道上空沿电线挂一串纸灯笼，挂钩对齐电线高度，摇晃复用 sway。
  const wireY = 5.05;
  const wireZ = 6.6;
  // 电线比 1 个像素还细，不描边的话远看会断成虚线；描边在屏幕上恒为 1 像素宽，能把它撑成一条连续的线
  add(kit.box(22.4, 0.03, 0.03, COLORS.metalDark, {
    x: 23.2, y: wireY, z: wireZ, shadow: false,
  }));
  [13.4, 16.6, 20.0, 23.4, 27.2, 30.6, 33.6].forEach((x, i) => {
    const lantern = paperLantern(p, i);
    add(kit.place(lantern, x, wireZ, 0, wireY - 0.82));
    const sway = lantern.getObjectByName('sway');
    if (sway) sways.push(sway);
  });

  const poleX = [11.6, 19.0, 27.0, 34.6];
  for (let i = 0; i < poleX.length; i++) {
    add(kit.place(utilityPole(p, 0), poleX[i], -2.55), { collide: true });
    if (i === 0) continue;
    const x0 = poleX[i - 1];
    const x1 = poleX[i];
    const span = x1 - x0;
    const mid = (x0 + x1) / 2;
    add(kit.box(span, 0.04, 0.04, COLORS.metalDark, {
      x: mid, y: 5.18, z: -2.55, shadow: false,
    }));
    add(kit.box(span * 0.52, 0.03, 0.03, COLORS.metalDark, {
      x: mid - span * 0.24, y: 4.72, z: -2.45, rz: -0.1, shadow: false,
    }));
    add(kit.box(span * 0.52, 0.03, 0.03, COLORS.metalDark, {
      x: mid + span * 0.24, y: 4.72, z: -2.45, rz: 0.1, shadow: false,
    }));
  }

  for (const x of [13.2, 22.2, 30.4]) {
    add(kit.place(streetLamp(p, x > 20 ? 1 : 0), x, 9.45, Math.PI));
  }
  add(kit.place(bench(p, 0), 18.6, 9.55, Math.PI));
  add(kit.place(trashBin(p, 1), 29.4, 9.6));

  return { sways, flickers };
}

function hangNoren(add: Add, x: number, z: number, color: string): void {
  for (let i = 0; i < 4; i++) {
    add(kit.box(0.32, 0.58, 0.035, i % 2 === 0 ? color : COLORS.white, {
      x: x - 0.6 + i * 0.4,
      y: 1.68,
      z,
      outline: false,
      shadow: false,
    }));
  }
}
