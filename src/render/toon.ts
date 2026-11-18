/**
 * 卡通材质 + 描边。所有可见模型都应通过这里创建材质，保证全局风格一致。
 *
 * - toonMaterial(color)：3 阶硬阴影的 MeshToonMaterial，按颜色缓存复用（不要手动 dispose）
 * - addOutline(mesh)：反向外壳描边（inverted hull）。几何体需大致以自身原点为中心。
 * - setOutlineColor / setOutlineVisible：全局控制
 */
import * as THREE from 'three';

const STEPS = 3;
const gradientMap = (() => {
  const data = new Uint8Array(STEPS * 4);
  // 暗部 → 中间 → 亮部。调整这几个值可以改变整体“动漫感”
  const levels = [90, 170, 255];
  for (let i = 0; i < STEPS; i++) data.set([levels[i], levels[i], levels[i], 255], i * 4);
  const tex = new THREE.DataTexture(data, STEPS, 1, THREE.RGBAFormat);
  tex.minFilter = tex.magFilter = THREE.NearestFilter;
  tex.needsUpdate = true;
  return tex;
})();

const matCache = new Map<string, THREE.MeshToonMaterial>();

export interface ToonOptions {
  emissive?: string; // 自发光（霓虹灯、灯笼）
  emissiveIntensity?: number;
  transparent?: boolean;
  opacity?: number;
}

export function toonMaterial(color: THREE.ColorRepresentation, opts: ToonOptions = {}): THREE.MeshToonMaterial {
  const key = `${new THREE.Color(color).getHexString()}|${JSON.stringify(opts)}`;
  let m = matCache.get(key);
  if (!m) {
    m = new THREE.MeshToonMaterial({
      color,
      gradientMap,
      emissive: opts.emissive ?? 0x000000,
      emissiveIntensity: opts.emissiveIntensity ?? 1,
      transparent: opts.transparent ?? false,
      opacity: opts.opacity ?? 1,
    });
    matCache.set(key, m);
  }
  return m;
}

// ---------- 描边 ----------
const outlineMaterial = new THREE.MeshBasicMaterial({ color: 0x1a1020, side: THREE.BackSide });
const OUTLINE_TAG = '__outline';

export function setOutlineColor(color: THREE.ColorRepresentation): void {
  outlineMaterial.color.set(color);
}

export function setOutlineVisible(visible: boolean): void {
  outlineMaterial.visible = visible;
}

/**
 * 给 mesh 加描边外壳。thickness 是世界单位的大约厚度。
 * 小物体（< 0.3m）建议不加描边，否则会糊成一团。
 */
export function addOutline(mesh: THREE.Mesh, thickness = 0.04): THREE.Mesh {
  mesh.geometry.computeBoundingSphere();
  const r = mesh.geometry.boundingSphere?.radius || 1;
  const shell = new THREE.Mesh(mesh.geometry, outlineMaterial);
  shell.name = OUTLINE_TAG;
  shell.scale.setScalar(1 + thickness / r);
  shell.castShadow = false;
  shell.receiveShadow = false;
  shell.raycast = () => {};
  mesh.add(shell);
  return mesh;
}
