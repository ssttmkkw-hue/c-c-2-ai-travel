/**
 * 站立 NPC 的反应：走近会看你、再近会转身、第一次靠近小跳一下。
 * 缓动在 dt === 0 时不动（冻结帧不改姿态）。
 * 交谈中的点头写在 animate() 之后，所以挂在更晚注册的 onUpdate 里。
 */
import { bus } from '@/core/events';
import type { MapBuildContext } from '@/world/MapCard';
import type { AvatarRig } from '@/avatar/types';
import type { NpcDef } from './types';

/** 全图共用一份。每个 NPC 只读，地图卸了也不用逐个解绑 */
let talkingId: string | null = null;
let talkWired = false;

function wireTalk(): void {
  if (talkWired) return;
  talkWired = true;
  bus.on('npc:interact', ({ npcId }) => {
    talkingId = npcId;
  });
  bus.on('ui:modal', ({ id, open }) => {
    if (id === 'dialogue' && !open) talkingId = null;
  });
}

export function attachNpcBehavior(ctx: MapBuildContext, rig: AvatarRig, def: NpcDef, _index: number): void {
  wireTalk();
  const homeYaw = def.yaw ?? 0;
  let noticed = false;
  let greeting = false;
  let greet = 0;
  let greetedAt = -1e9;

  ctx.onUpdate((dt, t) => {
    if (dt === 0) return;

    const p = ctx.getPlayerPosition();
    const dx = p.x - def.x;
    const dz = p.z - def.z;
    const dist = Math.hypot(dx, dz);
    const wasNoticed = noticed;
    if (!noticed && dist < 4) noticed = true;
    else if (noticed && dist > 5) noticed = false;

    const toPlayer = Math.atan2(-dx, -dz);
    const bodyTarget = dist < 2.6 ? toPlayer : homeYaw;
    rig.root.rotation.y = dampAngle(rig.root.rotation.y, bodyTarget, 5, dt);

    const headYaw = noticed ? clamp(shortest(toPlayer - rig.root.rotation.y), -0.9, 0.9) : 0;
    rig.head.rotation.y = damp(rig.head.rotation.y, headYaw, 6, dt);

    if (!wasNoticed && noticed && t - greetedAt > 20) {
      greeting = true;
      greet = 0;
      greetedAt = t;
    }
    if (greeting) {
      greet += dt / 0.3;
      if (greet >= 1) {
        greeting = false;
        rig.root.position.y = 0;
      } else {
        rig.root.position.y = 0.18 * Math.sin(Math.PI * greet);
      }
    }

    if (talkingId === def.id) rig.head.rotation.x = Math.sin(t * 6) * 0.06;
    else rig.head.rotation.x = damp(rig.head.rotation.x, 0, 6, dt);
  });
}

function damp(current: number, target: number, lambda: number, dt: number): number {
  return current + (target - current) * (1 - Math.exp(-lambda * dt));
}

function shortest(delta: number): number {
  return Math.atan2(Math.sin(delta), Math.cos(delta));
}

function dampAngle(current: number, target: number, lambda: number, dt: number): number {
  return current + shortest(target - current) * (1 - Math.exp(-lambda * dt));
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}
