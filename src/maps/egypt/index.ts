/** 埃及（占位地图卡，Cursor 在任务卡 T08 中完善） */
import type { MapCardDef } from '@/world/MapCard';
import * as kit from '@/art/kit';
import { palette } from './palette';

const card: MapCardDef = {
  id: 'egypt',
  name: '吉萨',
  nameLocal: 'الجيزة',
  country: '埃及',
  tagline: '金字塔下的沙漠落日',
  palette,
  spawn: { x: 0, z: 35, yaw: 0 },
  halfSize: 50,
  build(ctx) {
    const p = ctx.palette;
    ctx.add(kit.box(140, 0.2, 140, p.ground, { y: -0.1, outline: false, shadow: false }));
    const pyramids: [number, number, number][] = [[0, -15, 14], [-24, -2, 9], [20, 5, 6]];
    for (const [x, z, s] of pyramids) {
      const pyr = kit.cone(s * 1.15, s, 4, p.primary[1], { y: s / 2, ry: Math.PI / 4 });
      ctx.add(kit.place(kit.group(pyr), x, z), { collide: true });
    }
    // 棕榈树（占位）
    for (let i = 0; i < 6; i++) {
      const palm = kit.group(
        kit.cylinder(0.12, 0.2, 3, '#8a6a3a', { y: 1.5 }),
        kit.cone(1.4, 0.6, 6, p.foliage[i % 2], { y: 3.1 }),
      );
      ctx.add(kit.place(palm, -12 + i * 5, 25 + (ctx.rand() - 0.5) * 6));
    }
  },
};

export default card;
