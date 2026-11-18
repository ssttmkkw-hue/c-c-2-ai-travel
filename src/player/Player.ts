/**
 * 玩家：移动、跳跃、碰撞、NPC 交互检测。
 * WASD 移动（相对相机方向），Shift 跑，Space 跳，E 交互。
 */
import * as THREE from 'three';
import type { Engine } from '@/core/Engine';
import { bus } from '@/core/events';
import { modals } from '@/core/ui';
import type { World } from '@/world/World';
import { createAvatar } from '@/avatar';
import type { AvatarRig } from '@/avatar/types';
import { CameraRig } from './CameraRig';

const WALK = 4;
const RUN = 7.5;
const JUMP = 6.5;
const GRAVITY = 20;
const ACCEL = 45;
const DECEL = 38;
const AIR_ACCEL = 14;
const JUMP_BUFFER = 0.12;
const JUMP_CUT = 1.4;
const RADIUS = 0.35;
const HEIGHT = 1.2;
const INTERACT_RANGE = 2.2;

export class Player {
  readonly position = new THREE.Vector3();
  readonly cam: CameraRig;
  avatar: AvatarRig;
  private velY = 0;
  private readonly vel = new THREE.Vector3();
  private readonly wish = new THREE.Vector3();
  private jumpBuffer = 0;
  private wasAir = false;
  private facing = 0;
  private nearbyNpc: string | null = null;

  constructor(private engine: Engine, private world: World) {
    this.cam = new CameraRig(engine);
    this.cam.obstacles = () => this.world.colliders;
    this.avatar = createAvatar();
    engine.scene.add(this.avatar.root);
    bus.on('map:loaded', ({ card }) => this.teleport(card.spawn.x, card.spawn.z, card.spawn.yaw));
    bus.on('camera:mode', ({ mode }) => (this.avatar.root.visible = mode === 'third'));
    bus.on('outfit:equip', ({ outfitId }) => this.avatar.setOutfit(outfitId));
    engine.onUpdate((dt) => this.update(dt));
  }

  teleport(x: number, z: number, yaw: number): void {
    this.position.set(x, 0, z);
    this.velY = 0;
    this.vel.set(0, 0, 0);
    this.jumpBuffer = 0;
    this.wasAir = false;
    this.facing = this.cam.yaw = yaw;
  }

  /** 是否有 UI 弹窗打开（此时冻结玩家输入） */
  get inputBlocked(): boolean {
    return modals.any();
  }

  private update(dt: number): void {
    const { input } = this.engine;
    const blocked = this.inputBlocked;
    const down = (code: string) => !blocked && input.isDown(code);

    // ---- 水平移动（相对相机朝向） ----
    const f = (down('KeyW') ? 1 : 0) - (down('KeyS') ? 1 : 0);
    const s = (down('KeyD') ? 1 : 0) - (down('KeyA') ? 1 : 0);
    this.wish.set(0, 0, 0);
    if (f || s) {
      const yaw = this.cam.yaw;
      this.wish.set(-Math.sin(yaw) * f + Math.cos(yaw) * s, 0, -Math.cos(yaw) * f - Math.sin(yaw) * s);
      this.wish.normalize().multiplyScalar(down('ShiftLeft') || down('ShiftRight') ? RUN : WALK);
      this.facing = dampAngle(this.facing, Math.atan2(-this.wish.x, -this.wish.z), 12 * dt);
    }
    const onGround = this.position.y <= 0.0001;
    const rate = onGround ? (this.wish.lengthSq() > 0 ? ACCEL : DECEL) : AIR_ACCEL;
    approach(this.vel, this.wish, rate * dt);
    const prevX = this.position.x;
    const prevZ = this.position.z;
    this.position.addScaledVector(this.vel, dt);
    this.resolveCollisions();
    if (dt > 0) {
      this.vel.x = (this.position.x - prevX) / dt;
      this.vel.z = (this.position.z - prevZ) / dt;
    }

    // ---- 跳跃 / 重力（地面固定 y=0，没有土狼时间） ----
    if (!blocked && input.wasPressed('Space')) this.jumpBuffer = JUMP_BUFFER;
    else this.jumpBuffer -= dt;
    if (onGround && this.jumpBuffer > 0) {
      this.velY = JUMP;
      this.jumpBuffer = 0;
      bus.emit('player:jump', {});
    }
    // 用这一帧的平均速度积分。半隐式欧拉在 30ms 一帧时会把满跳从 1.06 米压到 0.95 米以下。
    const extraG = this.velY > 0 && !down('Space') ? JUMP_CUT : 0;
    const nextVy = this.velY - GRAVITY * (1 + extraG) * dt;
    this.position.y = Math.max(0, this.position.y + (this.velY + nextVy) * 0.5 * dt);
    this.velY = nextVy;
    if (this.position.y === 0 && this.wasAir) bus.emit('player:land', { speed: -this.velY });
    if (this.position.y === 0) this.velY = Math.max(this.velY, 0);
    this.wasAir = this.position.y > 0;

    // ---- 相机 & 角色 ----
    this.cam.update(dt, this.position, blocked);
    if (this.cam.mode === 'first') this.facing = this.cam.yaw;
    this.avatar.root.position.copy(this.position);
    this.avatar.root.rotation.y = this.facing;
    this.avatar.animate(dt, Math.hypot(this.vel.x, this.vel.z), this.position.y > 0.01);
    this.world.playerPosition.copy(this.position);

    this.checkNpcs(!blocked && input.wasPressed('KeyE'));
  }

  /** 圆柱(玩家) vs 轴对齐盒(建筑) 的 XZ 平面推出 */
  private resolveCollisions(): void {
    const p = this.position;
    for (const b of this.world.colliders) {
      if (b.max.y < p.y + 0.2 || b.min.y > p.y + HEIGHT) continue;
      const cx = THREE.MathUtils.clamp(p.x, b.min.x, b.max.x);
      const cz = THREE.MathUtils.clamp(p.z, b.min.z, b.max.z);
      const dx = p.x - cx;
      const dz = p.z - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 > RADIUS * RADIUS) continue;
      if (d2 > 1e-8) {
        const d = Math.sqrt(d2);
        p.x = cx + (dx / d) * RADIUS;
        p.z = cz + (dz / d) * RADIUS;
      } else {
        // 中心已经在盒子内部：沿最短方向推出
        const pushes = [b.min.x - RADIUS - p.x, b.max.x + RADIUS - p.x, b.min.z - RADIUS - p.z, b.max.z + RADIUS - p.z];
        const i = pushes.reduce((best, v, idx) => (Math.abs(v) < Math.abs(pushes[best]) ? idx : best), 0);
        if (i < 2) p.x += pushes[i];
        else p.z += pushes[i];
      }
    }
    const half = this.world.current?.halfSize ?? 50;
    p.x = THREE.MathUtils.clamp(p.x, -half, half);
    p.z = THREE.MathUtils.clamp(p.z, -half, half);
  }

  private checkNpcs(interact: boolean): void {
    let best: string | null = null;
    let bestD = INTERACT_RANGE;
    for (const n of this.world.npcs) {
      const d = n.object.position.distanceTo(this.position);
      if (d < bestD) {
        bestD = d;
        best = n.id;
      }
    }
    if (best !== this.nearbyNpc) {
      this.nearbyNpc = best;
      bus.emit('npc:nearby', { npcId: best });
    }
    if (interact && best) bus.emit('npc:interact', { npcId: best });
  }
}

/** 水平速度朝目标靠近，这一帧最多改变 maxDelta（米/秒） */
function approach(vel: THREE.Vector3, wish: THREE.Vector3, maxDelta: number): void {
  const dx = wish.x - vel.x;
  const dz = wish.z - vel.z;
  const len = Math.hypot(dx, dz);
  if (len <= maxDelta) {
    vel.x = wish.x;
    vel.z = wish.z;
    return;
  }
  vel.x += (dx / len) * maxDelta;
  vel.z += (dz / len) * maxDelta;
}

function dampAngle(from: number, to: number, t: number): number {
  let d = to - from;
  d = Math.atan2(Math.sin(d), Math.cos(d));
  return from + d * Math.min(1, t);
}
