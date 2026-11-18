/**
 * 东京（示例地图卡 —— 目前只是占位布局，Cursor 在任务卡 T02 中完善）。
 * 这份文件也是“怎么写地图卡”的参考范例。
 */
import type { MapCardDef } from '@/world/MapCard';
import * as kit from '@/art/kit';
import { pick } from '@/render/palette';
import { palette } from './palette';

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
    { id: 'tokyo-guide', name: '小樱', x: 3, z: 12, yaw: Math.PI * 0.8, lines: ['欢迎来到东京！', '前面就是神社的鸟居哦。'] },
  ],
  build(ctx) {
    const p = ctx.palette;
    ctx.add(kit.box(120, 0.2, 120, p.ground, { y: -0.1, outline: false, shadow: false }));
    // 参道（石板路）
    ctx.add(kit.box(4, 0.05, 50, p.primary[0], { y: 0.03, z: 5, outline: false, shadow: false }));

    // 鸟居（占位版）
    const red = p.accent[3];
    const torii = kit.group(
      kit.cylinder(0.25, 0.3, 5, red, { x: -2.2, y: 2.5 }),
      kit.cylinder(0.25, 0.3, 5, red, { x: 2.2, y: 2.5 }),
      kit.box(6.4, 0.4, 0.5, red, { y: 4.4 }),
      kit.box(7.2, 0.35, 0.6, '#2b1838', { y: 5.1 }),
    );
    ctx.add(kit.place(torii, 0, 0));

    // 两侧楼房（占位：随机高度的方块 + 霓虹招牌）
    for (let i = 0; i < 8; i++) {
      for (const side of [-1, 1]) {
        const h = 5 + ctx.rand() * 9;
        const z = -20 + i * 6;
        const b = kit.box(6, h, 5, pick(p.primary, i + (side > 0 ? 1 : 0)), { y: h / 2 });
        ctx.add(kit.place(b, side * 10, z), { collide: true });
        const sign = kit.box(0.3, 1.6, 1.2, pick(p.accent, i), {
          x: side * 6.9, y: 2.5 + ctx.rand() * 2, z, emissive: pick(p.accent, i), emissiveIntensity: 0.8, outline: false,
        });
        ctx.add(sign);
      }
    }

    // 樱花树（占位）
    for (let i = 0; i < 10; i++) {
      const x = (ctx.rand() < 0.5 ? -1 : 1) * (3.5 + ctx.rand() * 2);
      const z = -15 + ctx.rand() * 35;
      const tree = kit.group(
        kit.cylinder(0.15, 0.22, 1.6, '#6b4a4a', { y: 0.8 }),
        kit.ball(1.3, pick(p.foliage, i % 2), { y: 2.3 }),
      );
      ctx.add(kit.place(tree, x, z));
    }

    // 尽头的神社主殿（占位）
    const shrine = kit.group(
      kit.box(10, 4, 7, p.primary[0], { y: 2 }),
      kit.cone(8, 3, 4, p.primary[3], { y: 5.5, ry: Math.PI / 4 }),
    );
    ctx.add(kit.place(shrine, 0, -30), { collide: true });
  },
};

export default card;
