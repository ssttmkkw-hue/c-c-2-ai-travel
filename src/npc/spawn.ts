/** 根据 NpcDef 在地图中生成 NPC。交互检测在 Player 中完成（靠近 + 按 E）。 */
import type * as THREE from 'three';
import type { MapBuildContext } from '@/world/MapCard';
import { createAvatar } from '@/avatar';
import type { NpcDef } from './types';

export function spawnNpcs(ctx: MapBuildContext, defs: NpcDef[]): { id: string; object: THREE.Object3D }[] {
  return defs.map((def) => {
    // 站立版：四肢合进髋部。会走路的 NPC 不要传 idle。头仍是关节，B3 用来转头。
    const rig = createAvatar(def.outfit, { idle: true });
    rig.root.userData.avatar = rig;
    rig.root.position.set(def.x, 0, def.z);
    rig.root.rotation.y = def.yaw ?? 0;
    ctx.add(rig.root, { collide: true });
    ctx.onUpdate((dt) => {
      // 雾很远的地方角色看不清，藏起来并停掉眨眼。视锥外的 mesh three 自己会剔，这里省的是雾里还在动的关节。
      const far = liveFogFar(rig.root) ?? ctx.palette.fogFar;
      const limit = far * 0.9;
      const p = ctx.getPlayerPosition();
      const dx = rig.root.position.x - p.x;
      const dz = rig.root.position.z - p.z;
      if (dx * dx + dz * dz > limit * limit) {
        rig.root.visible = false;
        return;
      }
      rig.root.visible = true;
      rig.animate(dt, 0, false);
    });
    return { id: def.id, object: rig.root };
  });
}

/** 地图根挂在场景上之后才能读到雾。雾的 far 会随时段变 */
function liveFogFar(obj: THREE.Object3D): number | null {
  let node: THREE.Object3D | null = obj;
  while (node.parent) node = node.parent;
  const fog = (node as THREE.Scene).fog;
  if (fog && 'far' in fog && typeof fog.far === 'number') return fog.far;
  return null;
}
