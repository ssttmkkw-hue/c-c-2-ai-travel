/**
 * 风格化水面（塞纳河、尼罗河）。
 *
 * 一张不透明的薄盒子，卡通材质合批会跳过它（不是 MeshToonMaterial），所以各占 1 次绘制。
 * 片元里做三件事，都不采样贴图、不做真反射：
 * - 沿世界坐标流动的色带（深水色 ↔ 浅水色）
 * - 朝天的一面掺一点天空色
 * - 离岸边约半米的一条泡沫
 *
 * 低画质（cheap）：色带走得更慢，泡沫不起伏，少一次正弦。
 * 像素风：色带量化成几档，和天空的色带同一路数。
 * 时间由 World 每帧 syncWaterFrame 写入，画面冻结时一起停。
 */
import * as THREE from 'three';

const shared = {
  time: { value: 0 },
  cheap: { value: 0 },
  bands: { value: 10 },
};

export interface WaterColors {
  /** 深水色，一般用调色板的 accent */
  deep: string;
  /** 浅水色，一般用天空主色 */
  shallow: string;
  /** 岸边泡沫。白沫用材质固有色 COLORS.white */
  foam: string;
  /** 假反射用的天空色 */
  sky: string;
}

/** 所有水面共用这一份时间 / 画质开关，换地图不用逐个找材质 */
export function syncWaterFrame(time: number, cheap: boolean, banded: boolean): void {
  shared.time.value = time;
  shared.cheap.value = cheap ? 1 : 0;
  shared.bands.value = banded ? 10 : 0;
}

export function createWaterMaterial(colors: WaterColors, half: { x: number; z: number }): THREE.ShaderMaterial {
  // merge 会把 number 型 uniform 复制成新对象，所以时间 / 画质开关在合并后再指回共享的那一份
  const uniforms = THREE.UniformsUtils.merge([
    THREE.UniformsLib.fog,
    {
      halfSize: { value: new THREE.Vector2(half.x, half.z) },
      deepColor: { value: new THREE.Color(colors.deep) },
      shallowColor: { value: new THREE.Color(colors.shallow) },
      foamColor: { value: new THREE.Color(colors.foam) },
      skyColor: { value: new THREE.Color(colors.sky) },
    },
  ]);
  uniforms.time = shared.time;
  uniforms.cheap = shared.cheap;
  uniforms.bands = shared.bands;
  return new THREE.ShaderMaterial({
    uniforms,
    vertexShader: /* glsl */ `
      #include <common>
      #include <fog_pars_vertex>
      varying vec3 vWorld;
      varying vec3 vLocal;
      varying vec3 vNormalW;
      void main() {
        vec4 worldPosition = modelMatrix * vec4( position, 1.0 );
        vWorld = worldPosition.xyz;
        vLocal = position;
        vNormalW = normalize( mat3( modelMatrix ) * normal );
        vec4 mvPosition = viewMatrix * worldPosition;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */ `
      #include <common>
      #include <fog_pars_fragment>
      uniform float time;
      uniform float cheap;
      uniform float bands;
      uniform vec2 halfSize;
      uniform vec3 deepColor;
      uniform vec3 shallowColor;
      uniform vec3 foamColor;
      uniform vec3 skyColor;
      varying vec3 vWorld;
      varying vec3 vLocal;
      varying vec3 vNormalW;
      void main() {
        float speed = cheap > 0.5 ? 0.12 : 0.32;
        float along = vWorld.x * 0.45 + vWorld.z * 0.16 - time * speed;
        float band = fract( along );
        if ( bands > 0.0 ) band = floor( band * bands + 0.5 ) / bands;
        vec3 col = mix( deepColor, shallowColor, band * 0.7 );

        vec3 n = normalize( vNormalW );
        float up = clamp( n.y, 0.0, 1.0 );
        // 低画质少掺一点天色，少一次混合的视觉变化，计算本身一样便宜
        col = mix( col, skyColor, up * ( cheap > 0.5 ? 0.12 : 0.3 ) );

        float shore = min( halfSize.x - abs( vLocal.x ), halfSize.y - abs( vLocal.z ) );
        float wobble = cheap > 0.5 ? 0.0 : sin( along * 4.0 ) * 0.12;
        float foam = step( shore, 0.45 + wobble ) * step( 0.65, n.y );
        col = mix( col, foamColor, foam );

        gl_FragColor = vec4( col, 1.0 );
        #include <fog_fragment>
      }`,
    fog: true,
  });
}
