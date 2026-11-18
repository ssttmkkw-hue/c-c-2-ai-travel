/**
 * 道具陈列馆。每类一行，从出生点朝 -Z 即可看到整张网格。
 */
import type * as THREE from 'three';
import type { MapCardDef } from '@/world/MapCard';
import * as kit from '@/art/kit';
import { palette } from './palette';
import {
  roundCrownTree, pineTree, sakuraTree, palmTree, bush,
  streetLamp, bench, trashBin, vendingMachine, postbox, trafficCone, fenceSegment,
  stoneLantern, utilityPole, paperLantern,
  rock, grassTuft, flowerPatch,
  house, shopfront, tower,
} from '@/art/props';

const card: MapCardDef = {
  id: 'gallery',
  name: '道具馆',
  nameLocal: 'Gallery',
  country: '开发用',
  devOnly: true,
  tagline: '通用道具按类排开，方便目视检查',
  palette,
  spawn: { x: 0, z: 32, yaw: 0 },
  halfSize: 48,
  npcs: [],
  build(ctx) {
    const p = ctx.palette;
    ctx.add(kit.box(140, 0.2, 140, p.ground, { y: -0.1, outline: false, shadow: false }));
    ctx.add(kit.box(6, 0.04, 70, p.primary[1], { y: 0.02, z: -2, outline: false, shadow: false }));

    const row = (z: number, gap: number, factories: Array<(variant: number) => THREE.Object3D>) => {
      const n = factories.length * 3;
      factories.forEach((make, ti) => {
        for (let variant = 0; variant < 3; variant++) {
          const index = ti * 3 + variant;
          const x = (index - (n - 1) / 2) * gap;
          ctx.add(kit.place(make(variant), x, z));
        }
      });
    };

    row(18, 4.2, [
      (v) => roundCrownTree(p, v),
      (v) => pineTree(p, v),
      (v) => sakuraTree(p, v),
      (v) => palmTree(p, v),
      (v) => bush(p, v),
    ]);

    row(13, 4.2, [
      (v) => stoneLantern(p, v),
      (v) => utilityPole(p, v),
      (v) => paperLantern(p, v),
    ]);

    row(8, 3.4, [
      (v) => streetLamp(p, v),
      (v) => bench(p, v),
      (v) => trashBin(p, v),
      (v) => vendingMachine(p, v),
      (v) => postbox(p, v),
      (v) => trafficCone(p, v),
      (v) => fenceSegment(p, 2.2 + v * 0.3, v),
    ]);

    row(-1, 2.6, [
      (v) => rock(p, v),
      (v) => grassTuft(p, v),
      (v) => flowerPatch(p, v),
    ]);

    const roofs = ['gable', 'flat', 'hip'] as const;
    const buildings: Array<(variant: number) => THREE.Object3D> = [
      (v) => house(p, { w: 5, d: 4.2, floors: 1 + (v % 2), roof: roofs[v] }, v),
      (v) => shopfront(p, { w: 4.6 }, v),
      (v) => tower(p, { floors: 4 + v }, v),
    ];
    buildings.forEach((make, ti) => {
      for (let variant = 0; variant < 3; variant++) {
        const x = (ti * 3 + variant - 4) * 8;
        const obj = make(variant);
        ctx.add(kit.place(obj, x, -8), { collide: true });
      }
    });
  },
};

export default card;
