/**
 * 巴黎：清晨薄雾里的塞纳河与埃菲尔铁塔。
 * 出生点朝 -Z。默认第三人称俯角里能看见四条腿、拱和两层平台，尖顶伸到画面上方。
 * 道具 / 建筑正面朝 +Z。MESH_BUDGET 只是参考线，超了只计数，不丢弃物体。
 */
import * as THREE from 'three';
import type { MapCardDef, MapBuildContext } from '@/world/MapCard';
import { pick } from '@/render/palette';
import * as kit from '@/art/kit';
import { COLORS } from '@/art/colors';
import { addGroundDetail } from '@/art/props';
import { addFallingParticles } from '@/fx/particles';
import { palette } from './palette';
import { TOWER, createEiffel } from './landmark';
import { buildStreet } from './street';
import { buildQuay } from './quay';

/** 场景网格参考线。描边外壳也算。超了只在 dev 打印，不丢弃物体。 */
const MESH_BUDGET = 1300;

type Add = MapBuildContext['add'];

const card: MapCardDef = {
  id: 'paris',
  name: '巴黎',
  nameLocal: 'Paris',
  country: '法国',
  tagline: '清晨薄雾里的塞纳河与铁塔',
  palette,
  spawn: { x: 0, z: 20, yaw: 0 },
  halfSize: 45,
  npcs: [
    {
      id: 'paris-guide',
      name: '克莱尔',
      x: -4.6,
      z: 16.6,
      yaw: 2.15,
      outfit: 'paris-stripe',
      lines: [
        '欢迎来到巴黎的清晨。我是导游克莱尔，雾还没散。',
        '正前方那座铁塔就是埃菲尔，四条腿撑着两层观景台，尖顶伸进雾里。',
        '大道尽头是塞纳河，石桥可以走过去，河边的绿箱子是书报摊。',
        '右手边红棚子是咖啡馆，要咖啡找吕克。梧桐和老路灯都还亮着一点。',
      ],
      guide: {
        persona: '巴黎导游克莱尔，语气轻、句子短，喜欢讲铁塔、塞纳河和清晨的咖啡馆',
        topics: ['埃菲尔铁塔', '塞纳河', '石桥', '书报摊', '咖啡馆', '奥斯曼公寓'],
      },
    },
    {
      id: 'paris-waiter',
      name: '吕克',
      x: 9.15,
      z: 11.3,
      yaw: -Math.PI / 2,
      outfit: 'tokyo-student',
      lines: [
        '红棚子底下的位子都能看见河。糖在桌上，自己加。',
        '鸽子会来啄面包屑，别追，它们绕着大道飞。',
      ],
    },
  ],
  build(ctx) {
    const p = ctx.palette;
    const budget = track(ctx);

    budget.add(kit.box(200, 0.24, 200, p.ground, { y: -0.12, outline: false, shadow: false }));

    // 地面细节：石板色块 + 墙根小草 + 石子（中央步道、塞纳河、塔下广场不放）
    addGroundDetail(ctx, {
      half: 40,
      avoid: [[-2.7, -9, 2.7, 23], [-43, -22.5, 43, -9.8], [-8, -35, 8, -23]],
      tiles: { count: 300, grid: 1.2, size: [1.2, 2.4], contrast: 0.03 },
      tufts: { count: 40, colors: [p.foliage[0], p.foliage[2]] },
      pebbles: { count: 60, colors: [COLORS.stone, COLORS.stoneLight] },
    });
    addFallingParticles(ctx, { shape: 'leaf', count: 90, color: p.accent[1], size: 0.11 });
    // 路缘石
    for (const x of [-2.52, 2.52]) {
      budget.add(kit.box(0.16, 0.1, 30.7, COLORS.stone, { x, y: 0.05, z: 7, shadow: false }));
    }

    buildStreet(ctx, budget.add);
    budget.add(kit.place(createEiffel(p), TOWER.x, TOWER.z));
    for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]] as Array<[number, number]>) {
      const x = TOWER.x + sx * TOWER.foot;
      const z = TOWER.z + sz * TOWER.foot;
      ctx.addCollider(new THREE.Box3(
        new THREE.Vector3(x - 0.7, 0, z - 0.7),
        new THREE.Vector3(x + 0.7, 2.2, z + 0.7),
      ));
    }
    const anim = buildQuay(ctx, budget.add);
    buildEnclosure(budget.add, p);

    ctx.onUpdate((_dt, t) => {
      for (const bird of anim.flyers) {
        const ang = t * 0.55 + bird.phase;
        bird.root.position.set(
          Math.cos(ang) * bird.radius,
          5.4 + Math.sin(t * 2.1 + bird.phase) * 0.35,
          7 + Math.sin(ang) * bird.radius * 0.65,
        );
        bird.root.rotation.y = -ang + Math.PI / 2;
        const flap = Math.sin(t * 9 + bird.phase);
        bird.wingL.rotation.z = 0.35 + flap * 0.55;
        bird.wingR.rotation.z = -0.35 - flap * 0.55;
      }
      for (const bird of anim.peckers) {
        const peck = Math.sin(t * 3.2 + bird.phase);
        bird.root.rotation.x = peck > 0.45 ? (peck - 0.45) * 1.5 : 0;
      }
    });

    if (import.meta.env.DEV && budget.meshes > MESH_BUDGET) {
      console.info(`[巴黎] 网格计数 ${budget.meshes}，超过参考线 ${MESH_BUDGET}`);
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

/** 奶油石墙封住四边，墙在 halfSize 内侧。近处靠公寓和梧桐挡住平直的墙面。 */
function buildEnclosure(add: Add, p: MapBuildContext['palette']): void {
  const wall = (w: number, h: number, d: number, x: number, z: number, color: string) => {
    add(kit.box(w, h, d, color, { x, y: h / 2, z }), { collide: true });
  };
  wall(46, 7.4, 1.6, -22, -42.2, p.primary[2]);
  wall(46, 6.6, 1.6, 23, -42.2, p.primary[1]);
  wall(46, 6.8, 1.6, -22, 42.2, pick(p.primary, 1));
  wall(46, 7.6, 1.6, 23, 42.2, p.primary[2]);
  wall(1.6, 7.2, 44, -42.2, -20, p.primary[2]);
  wall(1.6, 6.5, 42, -42.2, 22, p.primary[1]);
  wall(1.6, 7.6, 44, 42.2, -20, p.primary[1]);
  wall(1.6, 6.8, 42, 42.2, 22, pick(p.primary, 2));
}

export default card;
