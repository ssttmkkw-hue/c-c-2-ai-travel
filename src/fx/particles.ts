/**
 * 飘落粒子（T11 轻量版）：花瓣 / 沙尘 / 落叶 / 雪。
 *
 * 一个 InstancedMesh（1 次 draw call），粒子只在玩家周围一个盒子里循环：
 * 玩家走到哪，盒子跟到哪，出了盒子的粒子从对面绕回来，所以看起来像整张图都在飘。
 * 画质「低」时关闭，「中」减半。地图卸载时自动清理（ctx.add + ctx.onUpdate）。
 *
 *   addFallingParticles(ctx, { shape: 'petal', count: 260, color: p.foliage[0] });
 */
import * as THREE from 'three';
import type { MapBuildContext } from '@/world/MapCard';
import { getSettings } from '@/core/settings';
import { markDynamic } from '@/render/batch';
import { DETAIL_SCALE } from '@/render/quality';
import { toonMaterial } from '@/render/toon';

export type ParticleShape = 'petal' | 'dust' | 'leaf' | 'snow';

export interface FallingParticleOpts {
  shape: ParticleShape;
  /** 粒子数（每张地图 ≤ 400） */
  count: number;
  color: string;
  /** 循环盒子的尺寸 [宽 x, 高 y, 深 z]（米），默认 [26, 9, 26] */
  area?: [number, number, number];
  /** 下落速度（米/秒） */
  speed?: number;
  /** 左右摆动幅度（米） */
  sway?: number;
  /** 风：水平漂移速度 [x, z]（米/秒） */
  wind?: [number, number];
  /** 粒子大小（米） */
  size?: number;
}

const SHAPES: Record<ParticleShape, { speed: number; sway: number; wind: [number, number]; size: number; spin: number; scale: [number, number, number] }> = {
  petal: { speed: 0.7, sway: 0.5, wind: [0.35, 0.15], size: 0.13, spin: 2.2, scale: [1, 0.12, 0.62] },
  leaf: { speed: 0.9, sway: 0.8, wind: [0.5, 0.2], size: 0.17, spin: 1.6, scale: [1, 0.1, 0.6] },
  dust: { speed: 0.12, sway: 0.25, wind: [2.6, 0.5], size: 0.06, spin: 0.6, scale: [1, 0.6, 1] },
  snow: { speed: 1.0, sway: 0.3, wind: [0.2, 0], size: 0.07, spin: 0.4, scale: [1, 1, 1] },
};

const MAX_COUNT = 400;

/** 离相机多近开始缩小 / 完全消失（米）：[消失, 开始缩小] */
const NEAR_FADE: [number, number] = [0.8, 1.6];

const mod = (v: number, m: number) => ((v % m) + m) % m;

export function addFallingParticles(ctx: MapBuildContext, o: FallingParticleOpts): void {
  const d = SHAPES[o.shape];
  const count = Math.min(MAX_COUNT, Math.max(0, Math.floor(o.count)));
  const [w, h, depth] = o.area ?? [26, 9, 26];
  const speed = o.speed ?? d.speed;
  const sway = o.sway ?? d.sway;
  const wind = o.wind ?? d.wind;
  const size = o.size ?? d.size;

  const geo = new THREE.BoxGeometry(size * d.scale[0], size * d.scale[1], size * d.scale[2]);
  const mesh = markDynamic(new THREE.InstancedMesh(geo, toonMaterial(o.color), count));
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.frustumCulled = false; // 粒子位置每帧在变，不做包围球
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.raycast = () => {};
  ctx.add(mesh);

  // 每个粒子：盒子里的初始位置 + 相位 + 个体差异
  const seed = new Float32Array(count * 6);
  for (let i = 0; i < count; i++) {
    seed.set([ctx.rand() * w, ctx.rand() * h, ctx.rand() * depth, ctx.rand() * Math.PI * 2, 0.7 + ctx.rand() * 0.6, ctx.rand() * Math.PI * 2], i * 6);
  }

  const m = new THREE.Matrix4();
  const pos = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  const euler = new THREE.Euler();
  const scale = new THREE.Vector3();
  // 贴着镜头的粒子会变成一大块色块挡住画面：离相机 1.6m 以内逐渐缩小到 0。
  // 相机位置在渲染时顺手记下来（只读），下一帧用，差一帧看不出来
  const camPos = new THREE.Vector3(0, -1000, 0);
  mesh.onBeforeRender = (_r, _s, camera) => void camPos.setFromMatrixPosition(camera.matrixWorld);

  ctx.onUpdate((_dt, t) => {
    const shown = Math.round(count * DETAIL_SCALE[getSettings().quality]);
    mesh.visible = shown > 0;
    mesh.count = shown;
    if (!shown) return;
    const player = ctx.getPlayerPosition();
    for (let i = 0; i < shown; i++) {
      const k = i * 6;
      const phase = seed[k + 3];
      const vary = seed[k + 4];
      const swing = Math.sin(t * 1.3 * vary + phase) * sway;
      // 世界坐标里匀速漂移，再折回到以玩家为中心的盒子里
      const x = player.x + mod(seed[k] + wind[0] * t * vary + swing - player.x, w) - w / 2;
      const z = player.z + mod(seed[k + 2] + wind[1] * t * vary + Math.cos(t * 0.9 * vary + phase) * sway * 0.6 - player.z, depth) - depth / 2;
      const y = mod(seed[k + 1] - speed * vary * t, h) + 0.05;
      pos.set(x, y, z);
      quat.setFromEuler(euler.set(t * d.spin * vary + phase, seed[k + 5] + t * 0.4, swing * 0.8));
      scale.setScalar(THREE.MathUtils.clamp((pos.distanceTo(camPos) - NEAR_FADE[0]) / (NEAR_FADE[1] - NEAR_FADE[0]), 0, 1));
      mesh.setMatrixAt(i, m.compose(pos, quat, scale));
    }
    mesh.instanceMatrix.needsUpdate = true;
  });
}
