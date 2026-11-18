/** 根据 NpcDef 在地图中生成 NPC。交互检测在 Player 中完成（靠近 + 按 E）。 */
import type * as THREE from 'three';
import type { MapBuildContext } from '@/world/MapCard';
import { createAvatar } from '@/avatar';
import type { NpcDef } from './types';

export function spawnNpcs(ctx: MapBuildContext, defs: NpcDef[]): { id: string; object: THREE.Object3D }[] {
  return defs.map((def) => {
    const rig = createAvatar(def.outfit);
    rig.root.position.set(def.x, 0, def.z);
    rig.root.rotation.y = def.yaw ?? 0;
    ctx.add(rig.root, { collide: true });
    ctx.onUpdate((dt) => rig.animate(dt, 0, false));
    return { id: def.id, object: rig.root };
  });
}
