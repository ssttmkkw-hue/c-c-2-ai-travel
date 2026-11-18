/**
 * 相机控制：第三人称（默认）/ 第一人称，按 V 切换。
 * 鼠标（pointer lock 后）或方向键 ←→↑↓ 转视角，滚轮调第三人称距离。
 */
import * as THREE from 'three';
import type { Engine } from '@/core/Engine';
import { bus } from '@/core/events';
import { getSettings } from '@/core/settings';

export type CameraMode = 'third' | 'first';

const EYE_HEIGHT = 1.0;
const PIVOT_HEIGHT = 0.9;

export class CameraRig {
  mode: CameraMode = 'third';
  /** 水平角，0 = 看向 -Z */
  yaw = 0;
  pitch = -0.25;
  /** 滚轮要的距离。碰撞只会缩短实际机位，不改这个字段 */
  distance = 6;
  /** 会挡住镜头的盒子。玩家把它指到 world.colliders */
  obstacles: () => readonly THREE.Box3[] = () => [];

  private readonly pivot = new THREE.Vector3();
  private readonly dir = new THREE.Vector3();
  private readonly hit = new THREE.Vector3();
  private readonly ray = new THREE.Ray();
  /** 碰撞裁剪之后的实际距离 */
  private effDistance = this.distance;
  /** 缓动过的注视点高度，跳跃时不让整幅画面跟着跳 */
  private pivotY = PIVOT_HEIGHT;

  constructor(private engine: Engine) {}

  setMode(mode: CameraMode): void {
    this.mode = mode;
    if (mode === 'first') this.pitch = 0;
    bus.emit('camera:mode', { mode });
  }

  /** frozen = UI 弹窗打开中：只跟随目标，不响应输入 */
  update(dt: number, target: THREE.Vector3, frozen = false): void {
    const { input, camera } = this.engine;
    const { dx, dy } = input.consumeMouseDelta();
    const wheel = input.consumeWheel();
    // 弹窗打开时输入停，缓动仍用真实 dt。冻结帧（dt 本来就是 0）直接取目标值。
    const rawDt = dt;
    if (frozen) dt = 0;
    else if (input.wasPressed('KeyV')) this.setMode(this.mode === 'third' ? 'first' : 'third');

    const sens = frozen ? 0 : 0.0025 * getSettings().mouseSensitivity;
    this.yaw -= dx * sens;
    this.pitch -= dy * sens;
    const keyTurn = 2.2 * dt;
    if (input.isDown('ArrowLeft')) this.yaw += keyTurn;
    if (input.isDown('ArrowRight')) this.yaw -= keyTurn;
    if (input.isDown('ArrowUp')) this.pitch += keyTurn * 0.6;
    if (input.isDown('ArrowDown')) this.pitch -= keyTurn * 0.6;
    this.distance = THREE.MathUtils.clamp(this.distance + (frozen ? 0 : wheel) * 0.8, 3, 14);

    if (this.mode === 'first') {
      this.pitch = THREE.MathUtils.clamp(this.pitch, -1.3, 1.3);
      camera.position.set(target.x, target.y + EYE_HEIGHT, target.z);
      camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
    } else {
      this.pitch = THREE.MathUtils.clamp(this.pitch, -1.2, 0.35);
      const targetY = target.y + PIVOT_HEIGHT;
      this.pivotY = rawDt === 0 ? targetY : damp(this.pivotY, targetY, 10, rawDt);
      this.pivot.set(target.x, this.pivotY, target.z);
      const cp = Math.cos(this.pitch);
      this.dir.set(Math.sin(this.yaw) * cp, -Math.sin(this.pitch), Math.cos(this.yaw) * cp);
      // 竖屏拉远乘在想要的距离上，再交给碰撞裁剪。横屏等于 this.distance。
      let limit = portraitDistance(this.distance, camera.aspect);
      for (const b of this.obstacles()) {
        if (b.max.y < 2.2) continue;
        if (Math.min(b.max.x - b.min.x, b.max.z - b.min.z) < 1) continue;
        if (b.containsPoint(this.pivot)) continue;
        this.ray.set(this.pivot, this.dir);
        if (this.ray.intersectBox(b, this.hit)) {
          limit = Math.min(limit, this.pivot.distanceTo(this.hit) - 0.35);
        }
      }
      limit = Math.max(1.2, limit);
      // 被挡住立刻拉近；空出来再慢慢退回。冻结帧直接落到目标距离。
      this.effDistance = limit < this.effDistance || rawDt === 0 ? limit : damp(this.effDistance, limit, 5, rawDt);
      camera.position.copy(this.pivot).addScaledVector(this.dir, this.effDistance);
      camera.position.y = Math.max(camera.position.y, 0.3);
      camera.lookAt(this.pivot);
    }
  }
}

function damp(current: number, target: number, lambda: number, dt: number): number {
  return current + (target - current) * (1 - Math.exp(-lambda * dt));
}

/**
 * 竖屏时相机稍拉远，避免抬高 fov 之后角色贴得太满。
 * 横屏（aspect >= 1）原样返回，滚轮调的 distance 也不改写。
 */
function portraitDistance(distance: number, aspect: number): number {
  if (!(aspect > 0) || aspect >= 1) return distance;
  const boost = 1 + (1 - aspect) * 0.28;
  return Math.min(distance * boost, 16);
}
