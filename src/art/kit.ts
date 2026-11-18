/**
 * 美术基础件（Art Kit）。所有道具 / 建筑 / 角色都用这些函数拼出来。
 *
 *   import * as kit from '@/art/kit';
 *   const house = kit.group(
 *     kit.box(4, 3, 4, p.primary[0], { y: 1.5 }),
 *     kit.cone(3.2, 1.6, 4, p.accent[0], { y: 3.8, ry: Math.PI / 4 }),
 *   );
 *
 * 约定：
 * - 单位 = 米。角色身高约 1.2m（Q 版）。
 * - 物体原点在“底部中心”（放在地面上 y=0 即可）。kit 函数的 y 参数是**部件中心**的高度。
 * - 颜色一律传入调色板里的颜色。
 */
import * as THREE from 'three';
import { toonMaterial, addOutline, type ToonOptions } from '@/render/toon';

export interface PartOpts extends ToonOptions {
  x?: number;
  y?: number;
  z?: number;
  rx?: number;
  ry?: number;
  rz?: number;
  /** 是否描边，默认 true */
  outline?: boolean;
  /** 是否投射阴影，默认 true */
  shadow?: boolean;
}

function finish(geo: THREE.BufferGeometry, color: THREE.ColorRepresentation, o: PartOpts): THREE.Mesh {
  const { x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, outline = true, shadow = true, ...mat } = o;
  const mesh = new THREE.Mesh(geo, toonMaterial(color, mat));
  mesh.position.set(x, y, z);
  mesh.rotation.set(rx, ry, rz);
  mesh.castShadow = shadow;
  mesh.receiveShadow = true;
  if (outline) addOutline(mesh);
  return mesh;
}

export function box(w: number, h: number, d: number, color: THREE.ColorRepresentation, o: PartOpts = {}): THREE.Mesh {
  return finish(new THREE.BoxGeometry(w, h, d), color, o);
}

/** 圆柱。segments 越少越 low-poly（默认 8） */
export function cylinder(rTop: number, rBottom: number, h: number, color: THREE.ColorRepresentation, o: PartOpts & { segments?: number } = {}): THREE.Mesh {
  return finish(new THREE.CylinderGeometry(rTop, rBottom, h, o.segments ?? 8), color, o);
}

/** 圆锥 / 棱锥。segments=4 就是金字塔，6~8 是树冠 */
export function cone(r: number, h: number, segments: number, color: THREE.ColorRepresentation, o: PartOpts = {}): THREE.Mesh {
  return finish(new THREE.ConeGeometry(r, h, segments), color, o);
}

/** 低模球（detail 0 = 二十面体，很 low-poly） */
export function ball(r: number, color: THREE.ColorRepresentation, o: PartOpts & { detail?: number } = {}): THREE.Mesh {
  return finish(new THREE.IcosahedronGeometry(r, o.detail ?? 0), color, o);
}

/** 把多个部件组合成一个物体，可整体设置位置/旋转 */
export function group(...children: THREE.Object3D[]): THREE.Group {
  const g = new THREE.Group();
  children.forEach((c) => g.add(c));
  return g;
}

/** 放置物体的小工具：kit.place(obj, x, z, rotY) */
export function place<T extends THREE.Object3D>(obj: T, x: number, z: number, ry = 0, y = 0): T {
  obj.position.set(x, y, z);
  obj.rotation.y = ry;
  return obj;
}
