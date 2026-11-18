/**
 * 埃菲尔铁塔。低模剪影：四条斜腿、南面能看见的拱、两层平台、交叉斜撑、尖顶。
 * 正面（朝出生点的那一面）是 +Z。中心到底可以走，碰撞只加在四只脚上。
 * 高约 40m。部件 40。
 */
import * as THREE from 'three';
import type { Palette } from '@/render/palette';
import * as kit from '@/art/kit';
import { COLORS } from '@/art/colors';

/** 塔底中心。脚在对角线上，偏移 FOOT 米。 */
export const TOWER = { x: 0, z: -32, foot: 5.6 };

const Y1 = 9.5;
const Y2 = 14.6;
const Y3 = 40;
const S0 = TOWER.foot;
const S1 = 2.2;
const S2 = 0.75;

const IRON = COLORS.metalDark;
const IRON_HI = COLORS.metal;

function spread(y: number): number {
  if (y <= Y1) return S0 + (S1 - S0) * (y / Y1);
  if (y <= Y2) return S1 + (S2 - S1) * ((y - Y1) / (Y2 - Y1));
  return S2 * Math.max(0, 1 - (y - Y2) / (Y3 - Y2));
}

/** 细长箱沿两点连线。长轴是本地 Y，再用四元数转到目标方向。 */
function strut(
  x0: number, y0: number, z0: number,
  x1: number, y1: number, z1: number,
  thick: number,
  color: string,
): THREE.Mesh {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const dz = z1 - z0;
  const len = Math.hypot(dx, dy, dz);
  const mesh = kit.box(thick, Math.max(len, 0.2), thick, color, {
    x: (x0 + x1) / 2,
    y: (y0 + y1) / 2,
    z: (z0 + z1) / 2,
  });
  mesh.quaternion.setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    new THREE.Vector3(dx, dy, dz).normalize(),
  );
  return mesh;
}

type Face = 'pz' | 'nz' | 'px' | 'nx';

function corners(y: number, face: Face): [THREE.Vector3, THREE.Vector3] {
  const s = spread(y);
  if (face === 'pz') return [new THREE.Vector3(s, y, s), new THREE.Vector3(-s, y, s)];
  if (face === 'nz') return [new THREE.Vector3(s, y, -s), new THREE.Vector3(-s, y, -s)];
  if (face === 'px') return [new THREE.Vector3(s, y, s), new THREE.Vector3(s, y, -s)];
  return [new THREE.Vector3(-s, y, s), new THREE.Vector3(-s, y, -s)];
}

function addX(parts: THREE.Object3D[], y0: number, y1: number, thick: number, face: Face): void {
  const [a0, b0] = corners(y0, face);
  const [a1, b1] = corners(y1, face);
  parts.push(strut(a0.x, a0.y, a0.z, b1.x, b1.y, b1.z, thick, IRON));
  parts.push(strut(b0.x, b0.y, b0.z, a1.x, a1.y, a1.z, thick, IRON));
}

/** 每面两根斜杆，在脸的中线汇成拱。拱底留空，人可以从桥上走过去。 */
function addArch(parts: THREE.Object3D[], face: Face): void {
  const [a, b] = corners(0.5, face);
  const peakY = 6;
  const peakS = spread(peakY) * 0.82;
  const peak = face === 'pz'
    ? new THREE.Vector3(0, peakY, peakS)
    : face === 'nz'
      ? new THREE.Vector3(0, peakY, -peakS)
      : face === 'px'
        ? new THREE.Vector3(peakS, peakY, 0)
        : new THREE.Vector3(-peakS, peakY, 0);
  parts.push(strut(a.x, 0.55, a.z, peak.x, peak.y, peak.z, 0.46, IRON_HI));
  parts.push(strut(b.x, 0.55, b.z, peak.x, peak.y, peak.z, 0.46, IRON_HI));
}

export function createEiffel(p: Palette): THREE.Group {
  const parts: THREE.Object3D[] = [];
  const signs: Array<[number, number]> = [[1, 1], [1, -1], [-1, 1], [-1, -1]];

  for (const [sx, sz] of signs) {
    parts.push(kit.box(1.25, 0.2, 1.25, IRON, { x: sx * S0, y: 0.1, z: sz * S0 }));
    parts.push(strut(sx * S0, 0.35, sz * S0, sx * S1, Y1, sz * S1, 0.78, IRON));
    parts.push(strut(sx * S1, Y1, sz * S1, sx * S2, Y2, sz * S2, 0.4, IRON));
  }

  const faces: Face[] = ['pz', 'nz', 'px', 'nx'];
  for (const face of faces) {
    addArch(parts, face);
    addX(parts, 7.1, Y1, 0.36, face);
    addX(parts, 11, Y2, 0.34, face);
  }

  parts.push(kit.box(S1 * 2 + 1.5, 0.42, S1 * 2 + 1.5, IRON_HI, { y: Y1 }));
  parts.push(kit.box(S2 * 2 + 1.05, 0.3, S2 * 2 + 1.05, IRON_HI, { y: Y2 }));
  parts.push(kit.cylinder(0.05, 0.32, Y3 - Y2, IRON_HI, { y: (Y3 + Y2) / 2, segments: 6 }));
  parts.push(kit.ball(0.32, p.accent[1], {
    y: Y3 + 0.15,
    emissive: p.accent[1],
    emissiveIntensity: 0.85,
  }));

  return kit.group(...parts);
}
