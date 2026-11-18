/**
 * 地图卡模板。新建地图卡：
 *   1. 复制本文件夹为 src/maps/<id>/
 *   2. 修改 palette / 基本信息 / build
 *   3. 在 src/world/registry.ts 注册
 * 规范：docs/MAP_CARD_SPEC.md   美术：docs/ART_GUIDE.md
 */
import type { MapCardDef } from '@/world/MapCard';
import * as kit from '@/art/kit';
import { palette } from './palette';

const card: MapCardDef = {
  id: 'template',
  name: '模板',
  nameLocal: 'Template',
  country: '—',
  tagline: '一句话介绍这个地方',
  palette,
  spawn: { x: 0, z: 20, yaw: 0 },
  halfSize: 50,
  npcs: [],
  build(ctx) {
    const p = ctx.palette;
    // 地面（不描边、不投影）
    ctx.add(kit.box(120, 0.2, 120, p.ground, { y: -0.1, outline: false, shadow: false }));
    // 地标（大物体 → collide: true）
    ctx.add(kit.place(kit.box(6, 8, 6, p.primary[0], { y: 4 }), 0, 0), { collide: true });
  },
};

export default card;
