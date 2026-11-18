/**
 * 吉萨：正午的金字塔群、东侧集市、西侧尼罗河。
 * 出生点朝 -Z，第三人称就能看见三座金字塔。
 * 道具 / 建筑正面朝 +Z。MESH_BUDGET 只是参考线，超了只计数，不丢弃物体。
 */
import * as THREE from 'three';
import type { MapCardDef, MapBuildContext } from '@/world/MapCard';
import { pick } from '@/render/palette';
import * as kit from '@/art/kit';
import { COLORS } from '@/art/colors';
import { house, rock } from '@/art/props';
import { palette } from './palette';
import {
  createPyramid, createSphinx, createObelisk,
  GREAT, KHAFRE, MENKAURE, SPHINX,
} from './landmark';
import { buildSouq } from './souq';

/** 场景网格参考线。描边外壳也算。超了只在 dev 打印，不丢弃物体。 */
const MESH_BUDGET = 1200;

type Add = MapBuildContext['add'];

const card: MapCardDef = {
  id: 'egypt',
  name: '吉萨',
  nameLocal: 'الجيزة',
  country: '埃及',
  tagline: '正午烈日下的金字塔与尼罗河',
  palette,
  spawn: { x: 0, z: 18, yaw: 0 },
  halfSize: 45,
  npcs: [
    {
      id: 'egypt-guide',
      name: '哈桑',
      x: 4.4,
      z: 15.4,
      yaw: 2.2,
      outfit: 'egypt-traveler',
      lines: [
        '欢迎来到吉萨。正午的沙子烫脚，我是导游哈桑。',
        '正前方最大的是胡夫金字塔，原来外面包着白色石灰岩。',
        '左边稍近的是哈夫拉，狮身人面像就蹲在它前面，脸朝这边。',
        '右边最小的是门卡乌拉。东边集市有荫，西边那条蓝的是尼罗河。',
      ],
      guide: {
        persona: '吉萨当地导游哈桑，语气热、句子短，爱讲三座金字塔和狮身人面像',
        topics: ['胡夫金字塔', '哈夫拉金字塔', '门卡乌拉金字塔', '狮身人面像', '尼罗河', '集市'],
      },
    },
    {
      id: 'egypt-vendor',
      name: '莱拉',
      x: 14.6,
      z: 5.6,
      yaw: Math.PI / 2,
      outfit: 'egypt-pharaoh',
      lines: [
        '陶罐和地毯都是河边烧的，骆驼这会儿只肯点头。',
        '棚子底下比金字塔脚下凉快。想听典故，去找哈桑。',
      ],
    },
  ],
  build(ctx) {
    const p = ctx.palette;
    const budget = track(ctx);

    budget.add(kit.box(220, 0.24, 220, p.ground, { y: -0.12, outline: false, shadow: false }));

    buildCauseway(budget.add);
    buildPyramids(budget.add, p);
    const anim = buildSouq(ctx, budget.add);
    buildDunes(budget.add, p);
    buildVillage(budget.add, p);
    buildEnclosure(budget.add, p);

    ctx.onUpdate((_dt, t) => {
      anim.camelHead.rotation.x = Math.sin(t * 0.7) * 0.16;
      anim.sail.rotation.z = Math.sin(t * 0.55) * 0.07;
      for (let i = 0; i < anim.waves.length; i++) {
        const wave = anim.waves[i];
        wave.position.y = 0.16 + Math.sin(t * 0.85 + i * 1.1) * 0.03;
        wave.position.x = Math.sin(t * 0.35 + i * 0.8) * 0.55;
      }
    });

    if (import.meta.env.DEV && budget.meshes > MESH_BUDGET) {
      console.info(`[吉萨] 网格计数 ${budget.meshes}，超过参考线 ${MESH_BUDGET}`);
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

/** 石板从出生点铺到金字塔前的广场，中间留出能走的路。 */
function buildCauseway(add: Add): void {
  for (let i = 0; i < 6; i++) {
    const z = 18 - i * 5;
    add(kit.box(4.6, 0.07, 4.5, i % 2 === 0 ? COLORS.stoneLight : COLORS.stone, {
      y: 0.05, z, outline: false, shadow: false,
    }));
  }
  add(kit.box(14, 0.06, 9, COLORS.stone, {
    y: 0.04, z: -12.2, outline: false, shadow: false,
  }));
}

function buildPyramids(add: Add, p: MapBuildContext['palette']): void {
  for (const spec of [GREAT, KHAFRE, MENKAURE]) {
    add(kit.place(createPyramid(p, spec), spec.x, spec.z), { collide: true });
  }
  add(kit.place(createSphinx(p), SPHINX.x, SPHINX.z), { collide: true });

  for (const [x, z] of [[-5.6, 11], [5.6, 11], [-5.6, 2.5], [5.6, 2.5]] as Array<[number, number]>) {
    add(kit.place(createObelisk(p), x, z), { collide: true });
  }

  const rubble: Array<[number, number, number]> = [
    [-8.5, -36, 2], [10, -36.5, 2], [24, -24, 2], [-28, -14, 2], [32, 12, 2], [-9, 23, 2],
  ];
  for (const [x, z, variant] of rubble) {
    add(kit.place(rock(p, variant), x, z), { collide: true });
  }
  add(kit.place(stoneStack(p, 0), 24.5, -22), { collide: true });
  add(kit.place(stoneStack(p, 1), -27.5, -27), { collide: true });
}

/** 采石剩下的石块堆。高约 1.1m。 */
function stoneStack(p: MapBuildContext['palette'], variant: number): THREE.Group {
  return kit.group(
    kit.box(1.5, 0.42, 0.85, pick(p.primary, variant), { y: 0.21 }),
    kit.box(1.15, 0.38, 0.7, pick(p.primary, variant + 1), { y: 0.58, ry: 0.12 }),
    kit.box(0.7, 0.32, 0.5, pick(p.primary, variant + 2), { y: 0.9, x: 0.08 }),
  );
}

/** 低沙丘，不加碰撞，只把平地垫出起伏。 */
function buildDunes(add: Add, p: MapBuildContext['palette']): void {
  const dunes: Array<[number, number, number, number, number, number]> = [
    [-12, 27, 3.4, 0.48, 2.4, 0],
    [13, 29, 3.1, 0.42, 2.2, 1],
    [24, 20, 2.8, 0.38, 2.1, 2],
    [-10, 6.5, 2.5, 0.32, 1.9, 1],
    [10.5, 3.2, 2.2, 0.28, 1.7, 0],
    [-27, -30, 3.6, 0.55, 2.6, 3],
    [29, -30, 3.2, 0.5, 2.4, 2],
    [8, 30, 3.2, 0.4, 2.2, 1],
    [33, -6, 2.6, 0.42, 2, 3],
    [23, 29, 2.6, 0.34, 2, 0],
  ];
  for (const [x, z, sx, sy, sz, color] of dunes) {
    const ball = kit.ball(1, pick(p.primary, color), { outline: false, shadow: false });
    ball.scale.set(sx, sy, sz);
    ball.position.y = sy * 0.82;
    add(kit.place(kit.group(ball), x, z));
    if (sy > 0.4) {
      const mound = kit.cone(sx * 0.55, sy * 1.3, 7, pick(p.primary, color + 1), {
        outline: false, shadow: false,
      });
      add(kit.place(mound, x + sx * 0.35, z + 0.6, 0, sy * 0.45));
    }
  }
}

/** 南侧和东侧的平顶土坯屋，把门朝向场地里面。 */
function buildVillage(add: Add, p: MapBuildContext['palette']): void {
  const south: Array<[number, number]> = [[-16, 0], [2, 1], [18, 2]];
  for (const [x, variant] of south) {
    add(kit.place(house(p, { w: 6.2, d: 4.6, floors: 1, roof: 'flat' }, variant), x, 35.2, Math.PI), { collide: true });
  }
  add(kit.place(house(p, { w: 6.4, d: 4.8, floors: 1, roof: 'flat' }, 1), 35.4, 22, -Math.PI / 2), { collide: true });
  add(kit.place(house(p, { w: 5.8, d: 4.6, floors: 1, roof: 'flat' }, 2), 35.2, -12, -Math.PI / 2), { collide: true });
}

/**
 * 岩壁和沙色围墙封住四边。墙在 halfSize 内侧，玩家走不出去。
 * 岩锥中心放在墙外，只把山头露进画面。
 */
function buildEnclosure(add: Add, p: MapBuildContext['palette']): void {
  const wall = (w: number, h: number, d: number, x: number, z: number, color: string) => {
    add(kit.box(w, h, d, color, { x, y: h / 2, z }), { collide: true });
  };
  wall(48, 9.2, 2.6, -22, -41.4, p.primary[3]);
  wall(48, 8.4, 2.6, 24, -41.4, p.primary[2]);
  wall(48, 6.6, 2.6, -22, 41.4, pick(p.primary, 2));
  wall(48, 7.2, 2.6, 24, 41.4, p.primary[3]);
  wall(2.6, 10.2, 44, -41.4, -18, p.primary[3]);
  wall(2.6, 9.4, 42, -41.4, 22, p.primary[2]);
  wall(2.6, 7.6, 44, 41.4, -18, p.primary[2]);
  wall(2.6, 8.2, 42, 41.4, 22, p.primary[3]);

  const cliffs: Array<[number, number, number, number, number]> = [
    [-30, -46.4, 6.2, 12, 3],
    [-8, -46.4, 5.4, 11, 2],
    [16, -46.2, 6, 12.5, 3],
    [34, -45.8, 5, 10, 2],
    [-46.2, -22, 5.2, 11, 3],
    [-46.4, 2, 5.6, 12, 2],
    [-46.2, 18, 5, 10.5, 3],
    [-45.6, 32, 4.6, 9.2, 2],
    [45.2, -4, 5, 10.5, 3],
    [44.6, 20, 4.4, 9, 2],
  ];
  for (const [x, z, r, h, color] of cliffs) {
    add(kit.cone(r, h, 6, pick(p.primary, color), { x, y: h / 2 - 0.6, z }));
  }
  // 河对岸的岩堆，挡住西侧围墙的平直轮廓。人过不了河，不加碰撞。
  const farBank: Array<[number, number, number, number, number]> = [
    [-35.5, -20, 6.4, 8.2, 3],
    [-36.5, -8, 4.2, 5.4, 2],
    [-36, 14, 6, 7.6, 3],
    [-35.2, 30, 5.4, 6.4, 2],
  ];
  for (const [x, z, r, h, color] of farBank) {
    add(kit.cone(r, h, 6, pick(p.primary, color), { x, y: h / 2 - 0.3, z }));
  }
}

export default card;
