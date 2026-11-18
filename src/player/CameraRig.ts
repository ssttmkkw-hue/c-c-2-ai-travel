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
  distance = 6;

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
      const pivot = new THREE.Vector3(target.x, target.y + PIVOT_HEIGHT, target.z);
      const cp = Math.cos(this.pitch);
      camera.position.set(
        pivot.x + Math.sin(this.yaw) * cp * this.distance,
        pivot.y - Math.sin(this.pitch) * this.distance,
        pivot.z + Math.cos(this.yaw) * cp * this.distance,
      );
      camera.position.y = Math.max(camera.position.y, 0.3);
      camera.lookAt(pivot);
    }
  }
}
