/**
 * 卡通材质 + 描边。所有可见模型都应通过这里创建材质，保证全局风格一致。
 *
 * - toonMaterial(color)：3 阶硬阴影的 MeshToonMaterial，按颜色缓存复用（不要手动 dispose）
 * - addOutline(mesh)：反向外壳描边（inverted hull）。
 * - setOutlineColor / setOutlineVisible / setOutlineWidth：全局控制
 *
 * 描边原理：外壳和本体共用几何体，在顶点着色器里沿「描边法线」把顶点往外推。
 * 推出的距离按视深折算，所以描边在屏幕上的粗细恒定（像素风 = 1 个虚拟像素），
 * 不会近处粗成一坨、远处细到断成虚线，也不随渲染分辨率变化。粗细由 Engine 在分辨率变化时设置。
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
  /** 颜色乘上几何体的顶点色（color 属性）。静态合批用：见 src/render/batch.ts */
  vertexColors?: boolean;
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
      vertexColors: opts.vertexColors ?? false,
    });
    m.onBeforeCompile = patchToonShadow;
    matCache.set(key, m);
  }
  return m;
}

/**
 * 让所有已缓存的卡通材质重新编译。
 * 只在改了会影响着色器的全局渲染状态时调用（目前是阴影过滤方式 renderer.shadowMap.type）。
 */
export function refreshToonMaterials(): void {
  matCache.forEach((m) => (m.needsUpdate = true));
}

// ---------- 阴影 ----------
/**
 * 对 three 内置卡通着色器的阴影部分做两处小改（只影响太阳这种平行光）：
 *
 * 1. 坡度偏移：阴影偏移量随「表面相对光线的倾斜程度」加大。
 *    卡通色阶会给背光面也分配亮度（半兰伯特），而阴影贴图存的正是物体背光面的深度，
 *    背光面等于拿自己和自己比，固定偏移量压不住倾斜面上的误差，会出一条条的自阴影条纹（树冠上最明显）。
 * 2. 硬边阈值：把柔化后的阴影值按 0.5 二值化。得到的影子边缘是硬的（像素风需要），
 *    但轮廓比直接硬采样平滑得多，没有阴影贴图像素造成的锯齿梳子边。
 *
 * 参数由 World 通过 setShadowTuning() 设置。
 */
const shadowTuning = { toonShadowSlope: { value: 0 }, toonShadowHard: { value: 1 } };

const SHADOW_CALL =
  'getShadow( directionalShadowMap[ i ], directionalLightShadow.shadowMapSize, directionalLightShadow.shadowIntensity, directionalLightShadow.shadowBias, directionalLightShadow.shadowRadius, vDirectionalShadowCoord[ i ] )';
const SHADOW_CALL_PATCHED =
  'toonShadow( getShadow( directionalShadowMap[ i ], directionalLightShadow.shadowMapSize, directionalLightShadow.shadowIntensity, directionalLightShadow.shadowBias - toonSlopeBias( geometryNormal, directLight.direction ), directionalLightShadow.shadowRadius, vDirectionalShadowCoord[ i ] ) )';
const lightsChunk = THREE.ShaderChunk.lights_fragment_begin;
const lightsChunkPatched = lightsChunk.replace(SHADOW_CALL, SHADOW_CALL_PATCHED);
/** 阴影着色器补丁是否套上了 three r170 的那一行。没套上时背光面会重新出现条纹，而且不会抛错 */
export const shadowPatchApplied = lightsChunkPatched !== lightsChunk;
if (!shadowPatchApplied) {
  console.warn('[toon] three 的 lights_fragment_begin 变了，阴影补丁没有生效（升级 three 后需要更新 SHADOW_CALL）');
}

function patchToonShadow(shader: THREE.WebGLProgramParametersWithUniforms): void {
  shader.uniforms.toonShadowSlope = shadowTuning.toonShadowSlope;
  shader.uniforms.toonShadowHard = shadowTuning.toonShadowHard;
  shader.fragmentShader = shader.fragmentShader
    .replace(
      '#include <shadowmap_pars_fragment>',
      /* glsl */ `#include <shadowmap_pars_fragment>
      uniform float toonShadowSlope;
      uniform float toonShadowHard;
      float toonSlopeBias( vec3 n, vec3 l ) {
        float c = abs( dot( n, l ) );
        return toonShadowSlope * min( sqrt( max( 1.0 - c * c, 0.0 ) ) / max( c, 1e-3 ), 8.0 );
      }
      float toonShadow( float s ) {
        return mix( s, step( 0.5, s ), toonShadowHard );
      }`,
    )
    .replace('#include <lights_fragment_begin>', lightsChunkPatched);
}

/**
 * 设置阴影补丁的参数。由 World 在画质 / 画面风格变化时调用。
 * @param slopeBias 坡度偏移系数 = 阴影贴图 1 像素对应的归一化深度 × 过滤核半径（像素）
 * @param hardEdge 是否把阴影二值化成硬边
 */
export function setShadowTuning(slopeBias: number, hardEdge: boolean): void {
  shadowTuning.toonShadowSlope.value = slopeBias;
  shadowTuning.toonShadowHard.value = hardEdge ? 1 : 0;
}

// ---------- 描边 ----------
const OUTLINE_TAG = '__outline';
/** 描边法线的顶点属性名（合批时要跟着几何体一起烘焙） */
export const OUTLINE_ATTR = 'outlineNormal';
/** 尖角处描边法线的最大长度（避免圆锥尖顶之类的地方描边被拉成长刺） */
const MAX_MITER = 2;

/** 每 1 米视深对应的描边世界宽度 = 粗细(px) × 2·tan(fov/2) / 渲染高度(px) */
const outlineWidth = { value: 0.003 };

const outlineMaterial = new THREE.MeshBasicMaterial({ color: 0x1a1020, side: THREE.BackSide });
outlineMaterial.onBeforeCompile = (shader) => {
  shader.uniforms.outlineWidth = outlineWidth;
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', `#include <common>\nattribute vec3 ${OUTLINE_ATTR};\nuniform float outlineWidth;`)
    .replace(
      '#include <project_vertex>',
      /* glsl */ `#include <project_vertex>
      float outlineLen = length( ${OUTLINE_ATTR} );
      if ( outlineLen > 0.0 ) {
        // 在视空间里外推：方向用 normalMatrix 变换（兼容非等比缩放），长度保留斜接长度
        vec3 outlineDir = normalize( normalMatrix * ${OUTLINE_ATTR} ) * outlineLen;
        mvPosition.xyz += outlineDir * ( outlineWidth * max( -mvPosition.z, 0.0 ) );
        gl_Position = projectionMatrix * mvPosition;
      }`,
    );
};

export function setOutlineColor(color: THREE.ColorRepresentation): void {
  outlineMaterial.color.set(color);
}

export function setOutlineVisible(visible: boolean): void {
  outlineMaterial.visible = visible;
}

/**
 * 设置描边在屏幕上的粗细。由 Engine 在渲染分辨率 / 画面风格变化时调用。
 * @param px 粗细，单位是「内部渲染分辨率」的像素
 * @param renderHeight 内部渲染分辨率的高
 * @param fovDeg 相机垂直视场角（度）
 */
export function setOutlineWidth(px: number, renderHeight: number, fovDeg: number): void {
  outlineWidth.value = (px * 2 * Math.tan(THREE.MathUtils.degToRad(fovDeg) / 2)) / Math.max(1, renderHeight);
}

/**
 * 给 mesh 加描边外壳。
 * 小物体（< 0.3m）建议不加描边，否则会糊成一团。
 */
export function addOutline(mesh: THREE.Mesh): THREE.Mesh {
  mesh.add(outlineShell(mesh.geometry));
  return mesh;
}

/** 用给定几何体造一个描边外壳（不挂到任何节点上）。几何体没有描边法线时会先算好 */
export function outlineShell(geo: THREE.BufferGeometry): THREE.Mesh {
  ensureOutlineNormals(geo);
  const shell = new THREE.Mesh(geo, outlineMaterial);
  shell.name = OUTLINE_TAG;
  shell.castShadow = false;
  shell.receiveShadow = false;
  shell.raycast = () => {};
  return shell;
}

export function isOutlineShell(obj: THREE.Object3D): boolean {
  return obj.name === OUTLINE_TAG;
}

/**
 * 计算「描边法线」属性：同一位置的所有顶点共用一个外推向量 d，使外壳不会在硬边处裂开。
 * d 满足「对该位置上的每个面法线 n 都有 n·d ≈ 1」（最小二乘），即每个面都被平行外推同样的距离——
 * 立方体的角是 (±1,±1,±1)，细长的盒子四周描边也一样粗（旧的整体缩放做法做不到）。
 */
export function ensureOutlineNormals(geo: THREE.BufferGeometry): void {
  if (geo.getAttribute(OUTLINE_ATTR)) return;
  if (!geo.getAttribute('normal')) geo.computeVertexNormals();
  const pos = geo.getAttribute('position');
  const nor = geo.getAttribute('normal');
  const count = pos.count;
  if (!geo.boundingSphere) geo.computeBoundingSphere();
  const q = 4096 / Math.max(geo.boundingSphere?.radius ?? 1, 1e-6); // 位置量化精度：包围球半径的 1/4096

  const groups = new Map<string, number[]>();
  for (let i = 0; i < count; i++) {
    const key = `${Math.round(pos.getX(i) * q)},${Math.round(pos.getY(i) * q)},${Math.round(pos.getZ(i) * q)}`;
    const g = groups.get(key);
    if (g) g.push(i);
    else groups.set(key, [i]);
  }

  const out = new Float32Array(count * 3);
  const n = new THREE.Vector3();
  const d = new THREE.Vector3();
  const m = new THREE.Matrix3();
  const unique: THREE.Vector3[] = [];
  const EPS = 1e-3; // 正则项：只有 1~2 个面法线时退化成最小范数解（1 个 → n，2 个 → 角平分方向）
  for (const idx of groups.values()) {
    unique.length = 0;
    for (const i of idx) {
      n.fromBufferAttribute(nor, i);
      if (n.lengthSq() < 1e-12) continue;
      n.normalize();
      if (!unique.some((u) => u.dot(n) > 0.9995)) unique.push(n.clone());
    }
    d.set(0, 0, 0);
    if (unique.length) {
      // 解 (NᵀN + εI) d = Nᵀ·1
      let xx = EPS, yy = EPS, zz = EPS, xy = 0, xz = 0, yz = 0;
      for (const u of unique) {
        xx += u.x * u.x; yy += u.y * u.y; zz += u.z * u.z;
        xy += u.x * u.y; xz += u.x * u.z; yz += u.y * u.z;
        d.add(u);
      }
      m.set(xx, xy, xz, xy, yy, yz, xz, yz, zz).invert();
      d.applyMatrix3(m);
      if (d.length() > MAX_MITER) d.setLength(MAX_MITER);
    }
    for (const i of idx) {
      out[i * 3] = d.x;
      out[i * 3 + 1] = d.y;
      out[i * 3 + 2] = d.z;
    }
  }
  geo.setAttribute(OUTLINE_ATTR, new THREE.BufferAttribute(out, 3));
}
