/**
 * 东京：黄昏的神社参道 + 东侧霓虹小街。
 * 出生点朝 -Z，一眼能看见鸟居和尽头的本殿。
 * 道具 / 建筑正面朝 +Z。MESH_BUDGET 只是参考线，超了只计数，不裁物体。
 */
import * as THREE from 'three';
import type { MapCardDef, MapBuildContext } from '@/world/MapCard';
import { pick } from '@/render/palette';
import * as kit from '@/art/kit';
import { COLORS } from '@/art/colors';
import {
  sakuraTree, bush, rock, flowerPatch, stoneLantern, fenceSegment, tower, house,
} from '@/art/props';
import { palette } from './palette';
import {
  createTorii, createShrine, createKomainu, createRedWhiteTower,
  TORII_PILLAR_X, TORII_Z, SHRINE_Z, SHRINE_FRONT_Z,
} from './landmark';
import { buildNeonStreet } from './street';

/** 场景网格参考线。描边外壳也算。超了只在 dev 打印，不丢弃物体。 */
const MESH_BUDGET = 1100;

type Add = MapBuildContext['add'];

const card: MapCardDef = {
  id: 'tokyo',
  name: '东京',
  nameLocal: '東京',
  country: '日本',
  tagline: '樱花、鸟居与霓虹街角',
  palette,
  spawn: { x: 0, z: 22, yaw: 0 },
  halfSize: 45,
  npcs: [
    {
      id: 'tokyo-guide',
      name: '小樱',
      x: 5.2,
      z: 19.5,
      yaw: Math.PI * 0.88,
      outfit: 'tokyo-student',
      lines: [
        '欢迎来到东京的黄昏。我是导游小樱。',
        '这条石板路是神社参道，正前方的朱红鸟居就是入口。',
        '往东拐进霓虹小街，面店和居酒屋的灯都亮着。',
        '参道尽头是本殿，门前一对狛犬，一只张嘴一只闭嘴。',
      ],
      guide: {
        persona: '东京本地导游小樱，语气短、亲切，喜欢讲神社和夜里的小街',
        topics: ['鸟居', '神社本殿', '樱花参道', '霓虹小街', '红白铁塔'],
      },
    },
    {
      id: 'tokyo-cook',
      name: '面店老板',
      x: 14.2,
      z: 3.55,
      yaw: Math.PI,
      outfit: 'tokyo-yukata',
      lines: [
        '汤头刚熬好，晚上这条街比白天亮得多。',
        '居酒屋的红灯笼会轻轻晃，别撞到招牌。',
      ],
    },
    {
      id: 'tokyo-visitor',
      name: '游客',
      x: -3.4,
      z: 12.2,
      yaw: 0.15,
      outfit: 'tokyo-straw',
      lines: [
        '穿过鸟居记得走中间，两边是留给神明的。',
        '你看东北边那座红白铁塔，黄昏里最清楚。',
      ],
    },
  ],
  build(ctx) {
    const p = ctx.palette;
    const budget = track(ctx);

    budget.add(kit.box(200, 0.24, 200, p.ground, { y: -0.12, outline: false, shadow: false }));

    buildApproach(ctx, budget.add);
    const anim = buildNeonStreet(ctx, budget.add);
    buildSkyline(budget.add, p);
    buildEnclosure(budget.add, p);

    ctx.onUpdate((_dt, t) => {
      for (let i = 0; i < anim.sways.length; i++) {
        anim.sways[i].rotation.z = Math.sin(t * 1.45 + i * 0.9) * 0.16;
        anim.sways[i].rotation.x = Math.sin(t * 1.05 + i * 0.6) * 0.04;
      }
      for (let i = 0; i < anim.flickers.length; i++) {
        anim.flickers[i].visible = Math.sin(t * 2.4 + i * 1.7) > -0.15;
      }
    });

    if (import.meta.env.DEV && budget.meshes > MESH_BUDGET) {
      console.info(`[东京] 网格计数 ${budget.meshes}，超过参考线 ${MESH_BUDGET}`);
    }
  },
};

function track(ctx: MapBuildContext): { add: Add; meshes: number } {
  const state = { meshes: 0 };
  const add: Add = (obj, opts) => {
    let n = 0;
    obj.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) n++;
    });
    state.meshes += n;
    return ctx.add(obj, opts);
  };
  return { add, get meshes() { return state.meshes; } };
}

/** 参道：石板、石灯笼、樱花，鸟居前后都有路。 */
function buildApproach(ctx: MapBuildContext, add: Add): void {
  const p = ctx.palette;

  for (let i = 0; i < 7; i++) {
    const z = 22 - i * 7;
    add(kit.box(4.5, 0.07, 6.35, i % 2 === 0 ? COLORS.stoneLight : COLORS.stone, {
      y: 0.055, z, outline: false, shadow: false,
    }));
  }
  add(kit.box(14, 0.05, 12, COLORS.stone, {
    y: 0.03, z: SHRINE_Z + 2.2, outline: false, shadow: false,
  }));

  add(kit.place(createTorii(p), 0, TORII_Z));
  const pillar = 0.42;
  for (const sx of [-1, 1]) {
    const x = sx * TORII_PILLAR_X;
    ctx.addCollider(new THREE.Box3(
      new THREE.Vector3(x - pillar, 0, TORII_Z - pillar),
      new THREE.Vector3(x + pillar, 6.2, TORII_Z + pillar),
    ));
  }

  add(kit.place(createShrine(p), 0, SHRINE_Z));
  ctx.addCollider(new THREE.Box3(
    new THREE.Vector3(-5.5, 0, SHRINE_Z - 4.1),
    new THREE.Vector3(5.5, 4.6, SHRINE_FRONT_Z),
  ));
  add(kit.place(createKomainu(p, true), -3.05, SHRINE_FRONT_Z + 0.7), { collide: true });
  add(kit.place(createKomainu(p, false), 3.05, SHRINE_FRONT_Z + 0.7), { collide: true });

  const lanternZ = [16.5, 6.5, -1.5, -17.5, -23.5];
  lanternZ.forEach((z, i) => {
    add(kit.place(stoneLantern(p, i % 3), -3.75, z, Math.PI / 2), { collide: true });
    if (z > 2 && z < 12) return;
    add(kit.place(stoneLantern(p, (i + 1) % 3), 3.75, z, -Math.PI / 2), { collide: true });
  });

  const trees: Array<[number, number, number]> = [
    [-7.4, 19.5, 0], [-7.6, 9.5, 1], [-7.2, -0.5, 2], [-7.8, -16.5, 0], [-7.2, -23.2, 1],
    [7.6, 19, 1], [7.4, -0.8, 2], [7.8, -16.2, 0], [7.3, -23.4, 2],
    [-13.5, 14, 2], [-14.2, -8, 0], [13.2, 16.5, 1],
  ];
  for (const [x, z, variant] of trees) {
    add(kit.place(sakuraTree(p, variant), x, z));
    ctx.addCollider(new THREE.Box3(
      new THREE.Vector3(x - 0.22, 0, z - 0.22),
      new THREE.Vector3(x + 0.22, 1.8, z + 0.22),
    ));
  }

  for (const x of [-6.4, 6.4]) {
    add(kit.place(bush(p, x < 0 ? 0 : 1), x, SHRINE_Z + 6.8));
    add(kit.place(flowerPatch(p, x < 0 ? 1 : 2), x * 0.85, SHRINE_Z + 8.2));
  }
  add(kit.place(rock(p, 1), -11.5, 3.5));
  add(kit.place(rock(p, 0), -12.4, -12));
  add(kit.place(rock(p, 2), 12.8, -20.5), { collide: true });

  for (const z of [15, 6, -14, -21]) {
    add(kit.place(fenceSegment(p, 4.2, 2), -10.6, z, Math.PI / 2), { collide: true });
  }
  add(kit.place(fenceSegment(p, 4.2, 2), -6.2, SHRINE_FRONT_Z - 0.4), { collide: true });
  add(kit.place(fenceSegment(p, 4.2, 2), 6.2, SHRINE_FRONT_Z - 0.4), { collide: true });
}

function buildSkyline(add: Add, p: MapBuildContext['palette']): void {
  const specs: Array<[number, number]> = [[-22, 5], [-11, 7], [-1, 4], [10, 6], [20, 5]];
  for (const [x, floors] of specs) {
    add(kit.place(tower(p, { floors }, floors % 3), x, -39.6), { collide: true });
  }
  add(kit.place(createRedWhiteTower(p), 30.5, -33.5), { collide: true });
}

/** 围墙封住视线，近处用矮楼挡住“盒子感”。 */
function buildEnclosure(add: Add, p: MapBuildContext['palette']): void {
  const wall = (w: number, h: number, d: number, x: number, z: number, color: string) => {
    add(kit.box(w, h, d, color, { x, y: h / 2, z }), { collide: true });
  };
  wall(46, 7.2, 1.4, -22, -42.6, p.primary[3]);
  wall(46, 6.4, 1.4, 23, -42.6, p.primary[2]);
  wall(46, 6.6, 1.4, -22, 42.6, pick(p.primary, 2));
  wall(46, 7.4, 1.4, 23, 42.6, p.primary[3]);
  wall(1.4, 6.8, 44, -42.6, -20, p.primary[2]);
  wall(1.4, 7.2, 42, -42.6, 22, p.primary[3]);
  wall(1.4, 7.6, 44, 42.6, -20, p.primary[3]);
  wall(1.4, 6.5, 42, 42.6, 22, pick(p.primary, 2));

  const block = (w: number, h: number, d: number, variant: number) => kit.group(
    kit.box(w, h, d, pick(p.primary, variant), { y: h / 2 }),
    kit.prism(w + 0.45, 0.8, d + 0.45, pick(p.primary, variant + 2), { y: h + 0.4 }),
    kit.box(0.7, 0.95, 0.06, COLORS.woodDark, { y: 0.55, z: d / 2 + 0.04, outline: false }),
    kit.box(w * 0.5, 0.4, 0.05, COLORS.glass, { y: h * 0.62, z: d / 2 + 0.04, outline: false }),
  );

  for (const [x, variant] of [[-24, 0], [-8, 1], [8, 2], [24, 1]] as Array<[number, number]>) {
    add(kit.place(house(p, { w: 7, d: 5, floors: 1, roof: 'gable' }, variant), x, 35.5, Math.PI), { collide: true });
  }
  for (const [z, variant, h] of [[-16, 0, 4.4], [2, 1, 5.2], [24, 2, 4.2]] as Array<[number, number, number]>) {
    add(kit.place(block(6.4, h, 4.6, variant), -35.2, z, Math.PI / 2), { collide: true });
  }
  for (const [z, variant, h] of [[-18, 2, 4.8], [22, 1, 4.6]] as Array<[number, number, number]>) {
    add(kit.place(block(6.2, h, 4.6, variant), 36.8, z, -Math.PI / 2), { collide: true });
  }
  add(kit.place(block(7.2, 5.6, 4.8, 3), 37.2, 6.6, -Math.PI / 2), { collide: true });
}

export default card;
