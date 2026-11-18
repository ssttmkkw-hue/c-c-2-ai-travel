/**
 * 静态合批：把一棵子树里**不会动**的 mesh 合并成少数几个大 mesh，draw call 从「每个零件一次」降到「每类一次」。
 *
 * 地图卡照常用 kit 一个零件一个零件地拼；World 在 card.build() 之后调用 batchStatic(root)：
 *
 * - 普通卡通材质（不透明、不发光）只有颜色不同 → 颜色烘进顶点色，全部并成一个 mesh（按是否投影 / 接收阴影最多分 4 组）
 * - 发光 / 半透明材质 → 按材质各并成一个 mesh
 * - 所有描边外壳 → 并成一个 mesh
 * - 合并后原来的 mesh 从场景树里摘掉（留下的空 Group 不影响渲染）
 *
 * 「动态」节点 = 每帧要改位置 / 旋转 / 缩放 / visible 的物体，用 kit.dynamic(obj) / markDynamic(obj) 标记。**必须标**，
 * 否则它的零件被并进上一级的静态 mesh，动画就不动了。动态节点是合批的边界：
 * - 它自己（如果是 mesh）原样保留
 * - 它的子树不并进上一级；opts.nested 时在它自己的坐标系里另外合一份（跟着它一起动），里面再有动态节点同理
 *
 * 不参与合并（原样保留）：
 * - 不可见的节点及其子树、下面还挂着别的东西的 mesh、InstancedMesh / Points / 非卡通材质的 mesh（特效自己管自己）
 *
 * 碰撞不受影响：碰撞盒在 ctx.add 时就按包围盒算好了，和渲染用的 mesh 无关。
 */
import * as THREE from 'three';
import { ensureOutlineNormals, isOutlineShell, outlineShell, toonMaterial, OUTLINE_ATTR } from './toon';

const BATCH_TAG = '__batch';

/** 标记「会动的物体」：它和它的子树不参与静态合批。返回原对象，方便链式写 */
export function markDynamic<T extends THREE.Object3D>(obj: T): T {
  obj.userData.dynamic = true;
  return obj;
}

export function isDynamic(obj: THREE.Object3D): boolean {
  return obj.userData.dynamic === true;
}

export interface BatchStats {
  /** 被合并掉的 mesh 数（不含描边外壳） */
  merged: number;
  /** 合并后新增的 mesh 数（含描边） */
  batches: number;
  triangles: number;
}

interface Entry {
  mesh: THREE.Mesh;
  /** mesh → 合批根节点的变换 */
  matrix: THREE.Matrix4;
  outline: boolean;
}

interface Bucket {
  material: THREE.Material;
  castShadow: boolean;
  receiveShadow: boolean;
  /** true = 把材质颜色写进顶点色（共用一个白色顶点色材质） */
  vertexColors: boolean;
  entries: Entry[];
}

/** 只有颜色不同的普通卡通材质：可以用顶点色合成一个 */
function isPlainToon(m: THREE.Material): m is THREE.MeshToonMaterial {
  const t = m as THREE.MeshToonMaterial;
  return (
    t.isMeshToonMaterial === true &&
    !t.transparent &&
    t.opacity === 1 &&
    !t.vertexColors &&
    !t.map &&
    (t.emissiveIntensity === 0 || t.emissive.getHex() === 0)
  );
}

export interface BatchOptions {
  /**
   * true = 动态节点内部也各自合批（零件并到这个动态节点自己的坐标系里，跟着它一起动）。
   * 比如摇晃的灯笼由 5 个零件组成 → 合成 1 个；角色的每个关节各合成 1 个。
   */
  nested?: boolean;
}

export interface BatchHandle extends BatchStats {
  /** 撤销合批：删掉合并出的 mesh，把原来的零件挂回原位。换装这类「改完再重新合批」的场景用 */
  restore(): void;
}

/**
 * 合并 root 下所有静态 mesh。合并结果挂在 root 下（nested 时动态节点内部的合并结果挂在各自的动态节点下）。
 * 调用前 root 可以还没加进场景；调用后不要再移动被合并的零件（移动了也不会生效）。
 */
export function batchStatic(root: THREE.Object3D, opts: BatchOptions = {}): BatchHandle {
  root.updateMatrixWorld(true);
  const removed: { mesh: THREE.Mesh; parent: THREE.Object3D }[] = [];
  const created: THREE.Mesh[] = [];
  const stats: BatchStats = { merged: 0, batches: 0, triangles: 0 };

  const run = (container: THREE.Object3D): void => {
    const toLocal = new THREE.Matrix4().copy(container.matrixWorld).invert();
    const buckets = new Map<string, Bucket>();
    const all: Entry[] = [];
    const inner: THREE.Object3D[] = [];

    const visit = (node: THREE.Object3D): void => {
      if (!node.visible) return;
      if (isDynamic(node)) {
        if (opts.nested) inner.push(node);
        return;
      }
      const mesh = node as THREE.Mesh;
      if (mesh.isMesh && !isOutlineShell(mesh)) {
        const entry = collect(mesh, toLocal);
        if (entry) {
          all.push(entry);
          const mat = mesh.material as THREE.Material;
          const plain = isPlainToon(mat);
          const key = `${plain ? 'vc' : mat.uuid}|${mesh.castShadow ? 1 : 0}${mesh.receiveShadow ? 1 : 0}`;
          let b = buckets.get(key);
          if (!b) {
            b = { material: mat, castShadow: mesh.castShadow, receiveShadow: mesh.receiveShadow, vertexColors: plain, entries: [] };
            buckets.set(key, b);
          }
          b.entries.push(entry);
          return; // 可合并的 mesh 没有（除描边外的）子节点
        }
      }
      for (const child of node.children) visit(child);
    };
    for (const child of container.children) visit(child);

    // 只有 1 个零件的组不值得合（省不了 draw call，还多占一份几何体）
    if (all.length > 1) {
      for (const b of buckets.values()) {
        const geo = mergeGeometry(b.entries, { normal: true, color: b.vertexColors, outline: false });
        const mesh = new THREE.Mesh(geo, b.vertexColors ? toonMaterial('#ffffff', { vertexColors: true }) : b.material);
        mesh.name = BATCH_TAG;
        mesh.castShadow = b.castShadow;
        mesh.receiveShadow = b.receiveShadow;
        created.push(mesh);
        container.add(mesh);
        stats.triangles += (geo.index?.count ?? 0) / 3;
      }
      const outlined = all.filter((e) => e.outline);
      if (outlined.length) {
        const shell = outlineShell(mergeGeometry(outlined, { normal: false, color: false, outline: true }));
        created.push(shell);
        container.add(shell);
      }
      for (const e of all) {
        removed.push({ mesh: e.mesh, parent: e.mesh.parent! });
        e.mesh.removeFromParent();
      }
      stats.merged += all.length;
    }
    for (const node of inner) run(node);
  };
  run(root);
  stats.batches = created.length;

  return {
    ...stats,
    restore() {
      for (const m of created) {
        m.removeFromParent();
        m.geometry.dispose();
      }
      for (const { mesh, parent } of removed) parent.add(mesh);
      created.length = removed.length = 0;
    },
  };
}

function collect(mesh: THREE.Mesh, toRoot: THREE.Matrix4): Entry | null {
  if (mesh.name === BATCH_TAG) return null; // 已经是合批结果
  if ((mesh as unknown as THREE.InstancedMesh).isInstancedMesh || (mesh as unknown as THREE.SkinnedMesh).isSkinnedMesh) return null;
  if (Array.isArray(mesh.material) || !(mesh.material as THREE.MeshToonMaterial).isMeshToonMaterial) return null;
  const geo = mesh.geometry;
  if (!geo.getAttribute('position') || geo.morphAttributes.position) return null;
  let outline = false;
  for (const c of mesh.children) {
    if (isOutlineShell(c)) outline = true;
    else return null; // mesh 下面还挂着别的东西：保守起见不动它
  }
  return { mesh, matrix: new THREE.Matrix4().multiplyMatrices(toRoot, mesh.matrixWorld), outline };
}

/** 把若干 mesh 的几何体烘到同一个坐标系里，拼成一个带索引的几何体（不保留 uv：卡通材质不用贴图） */
function mergeGeometry(entries: Entry[], want: { normal: boolean; color: boolean; outline: boolean }): THREE.BufferGeometry {
  let vertexCount = 0;
  let indexCount = 0;
  for (const { mesh } of entries) {
    const g = mesh.geometry;
    vertexCount += g.getAttribute('position').count;
    indexCount += g.index ? g.index.count : g.getAttribute('position').count;
  }
  const position = new Float32Array(vertexCount * 3);
  const normal = want.normal ? new Float32Array(vertexCount * 3) : null;
  const color = want.color ? new Float32Array(vertexCount * 3) : null;
  const outline = want.outline ? new Float32Array(vertexCount * 3) : null;
  const index = vertexCount > 65535 ? new Uint32Array(indexCount) : new Uint16Array(indexCount);

  const v = new THREE.Vector3();
  const normalMatrix = new THREE.Matrix3();
  let vo = 0; // 顶点偏移
  let io = 0; // 索引偏移
  for (const { mesh, matrix } of entries) {
    const g = mesh.geometry;
    const pos = g.getAttribute('position');
    const count = pos.count;
    normalMatrix.getNormalMatrix(matrix);

    for (let i = 0; i < count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(matrix).toArray(position, (vo + i) * 3);
    }
    if (normal) {
      if (!g.getAttribute('normal')) g.computeVertexNormals();
      const nor = g.getAttribute('normal');
      for (let i = 0; i < count; i++) {
        v.fromBufferAttribute(nor, i).applyMatrix3(normalMatrix).normalize().toArray(normal, (vo + i) * 3);
      }
    }
    if (color) {
      const c = (mesh.material as THREE.MeshToonMaterial).color; // 已经是线性空间
      for (let i = 0; i < count; i++) c.toArray(color, (vo + i) * 3);
    }
    if (outline) {
      ensureOutlineNormals(g);
      const on = g.getAttribute(OUTLINE_ATTR);
      for (let i = 0; i < count; i++) {
        // 和描边着色器里的算法一致：方向按法线矩阵变换，长度（斜接长度）保持不变
        const len = v.fromBufferAttribute(on, i).length();
        if (len > 0) v.applyMatrix3(normalMatrix).setLength(len);
        v.toArray(outline, (vo + i) * 3);
      }
    }

    // 镜像变换（行列式为负）会把三角形绕向翻过来，这里翻回去
    const flip = matrix.determinant() < 0;
    const n = g.index ? g.index.count : count;
    for (let i = 0; i < n; i += 3) {
      const a = g.index ? g.index.getX(i) : i;
      const b = g.index ? g.index.getX(i + 1) : i + 1;
      const c = g.index ? g.index.getX(i + 2) : i + 2;
      index[io + i] = vo + a;
      index[io + i + 1] = vo + (flip ? c : b);
      index[io + i + 2] = vo + (flip ? b : c);
    }
    vo += count;
    io += n;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(position, 3));
  if (normal) geo.setAttribute('normal', new THREE.BufferAttribute(normal, 3));
  if (color) geo.setAttribute('color', new THREE.BufferAttribute(color, 3));
  if (outline) geo.setAttribute(OUTLINE_ATTR, new THREE.BufferAttribute(outline, 3));
  geo.setIndex(new THREE.BufferAttribute(index, 1));
  geo.computeBoundingSphere();
  return geo;
}

interface Snapshot {
  node: THREE.Object3D;
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
  scale: THREE.Vector3;
  visible: boolean;
}

/**
 * 兜底检测：用几个假时间点试跑一遍地图卡注册的每帧回调，位置 / 旋转 / 缩放 / visible 变了的节点自动标成动态。
 * 返回新标记的节点（都是没有显式 markDynamic 的）。只能抓到「每帧都在动」的动画；
 * 偶尔才变一下的（闪烁、条件触发）不保证抓得到，所以地图卡里仍应显式标记。
 */
export function probeDynamic(root: THREE.Object3D, updaters: readonly ((dt: number, time: number) => void)[]): THREE.Object3D[] {
  if (!updaters.length) return [];
  const snaps: Snapshot[] = [];
  const visit = (node: THREE.Object3D): void => {
    // 已标记的节点本身不用查，但它里面可能还有没标的（比如只标了鸟，没标翅膀）
    if (!isDynamic(node)) {
      snaps.push({ node, position: node.position.clone(), quaternion: node.quaternion.clone(), scale: node.scale.clone(), visible: node.visible });
    }
    for (const child of node.children) visit(child);
  };
  for (const child of root.children) visit(child);

  const found = new Set<THREE.Object3D>();
  for (const t of [0.37, 1.93, 4.71, 8.29]) {
    for (const fn of updaters) fn(1 / 60, t);
    for (const s of snaps) {
      const n = s.node;
      if (n.visible !== s.visible || !n.position.equals(s.position) || !n.quaternion.equals(s.quaternion) || !n.scale.equals(s.scale)) found.add(n);
    }
  }
  found.forEach(markDynamic);
  return [...found];
}
