/**
 * 渐变天空：一个永远罩在相机外面的穹顶（1 次 draw call）。
 *
 * - 地平线颜色 = 雾色，往上先过渡到天空主色、再到天顶色 → 远景被雾吃掉时正好融进地平线，没有「雾和天空两个颜色」的接缝
 * - 地平线以下也是雾色（地面在雾里消失的地方看不出边）
 * - 朝太阳的方向有一圈光晕和一个硬边的太阳圆盘
 * - 像素风下把渐变切成色带（干净的色阶，不出现低分辨率下的杂色渐变）；高清下是平滑渐变
 *
 * 颜色全部来自调色板（skyTop / sky / fog / sun），由 World.applyPalette 设置。
 */
import * as THREE from 'three';

/** 像素风的色带数 */
const PIXEL_BANDS = 14;

export class Sky {
  readonly mesh: THREE.Mesh;
  private readonly uniforms = {
    topColor: { value: new THREE.Color() },
    midColor: { value: new THREE.Color() },
    horizonColor: { value: new THREE.Color() },
    sunColor: { value: new THREE.Color() },
    sunDir: { value: new THREE.Vector3(0, 1, 0) },
    bands: { value: PIXEL_BANDS },
  };

  constructor() {
    const material = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: /* glsl */ `
        varying vec3 vDir;
        void main() {
          vDir = position;
          // 只取相机的旋转：穹顶永远以相机为中心；深度压到远平面，被场景里所有东西挡住
          vec4 p = projectionMatrix * vec4( mat3( viewMatrix ) * position, 1.0 );
          gl_Position = p.xyww;
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 topColor;
        uniform vec3 midColor;
        uniform vec3 horizonColor;
        uniform vec3 sunColor;
        uniform vec3 sunDir;
        uniform float bands;
        varying vec3 vDir;
        const float MID = 0.3;
        void main() {
          vec3 dir = normalize( vDir );
          // 0 = 地平线及以下，1 = 天顶。开方让颜色在地平线附近变化快、往上变化慢
          float t = sqrt( clamp( dir.y, 0.0, 1.0 ) );
          float s = max( dot( dir, sunDir ), 0.0 );
          float glow = pow( s, 6.0 ) * 0.35;
          if ( bands > 0.0 ) {
            t = floor( t * bands + 0.5 ) / bands;
            glow = floor( glow * bands + 0.5 ) / bands;
          }
          // 三段：地平线（雾色）→ 天空主色（仰角约 5° 就到）→ 天顶色
          vec3 col = t < MID
            ? mix( horizonColor, midColor, t / MID )
            : mix( midColor, topColor, ( t - MID ) / ( 1.0 - MID ) );
          col = mix( col, sunColor, glow );
          col = mix( col, sunColor, step( 0.9985, s ) ); // 太阳圆盘（硬边）
          gl_FragColor = vec4( col, 1.0 );
        }`,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
    });
    this.mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 3), material);
    this.mesh.name = '__sky';
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 1000; // 不透明物体里最后画：只填没被场景挡住的像素
    this.mesh.castShadow = this.mesh.receiveShadow = false;
    this.mesh.raycast = () => {};
  }

  /**
   * @param top 天顶色
   * @param mid 天空主色（地平线上方不远处就过渡到它）
   * @param horizon 地平线色（应与雾色一致）
   * @param sun 太阳圆盘 / 光晕颜色
   * @param sunDir 指向太阳的方向（世界坐标，会被归一化）
   */
  set(top: THREE.ColorRepresentation, mid: THREE.ColorRepresentation, horizon: THREE.ColorRepresentation, sun: THREE.ColorRepresentation, sunDir: THREE.Vector3): void {
    this.uniforms.topColor.value.set(top);
    this.uniforms.midColor.value.set(mid);
    this.uniforms.horizonColor.value.set(horizon);
    this.uniforms.sunColor.value.set(sun);
    this.uniforms.sunDir.value.copy(sunDir).normalize();
  }

  /** 像素风用色带，高清用平滑渐变 */
  setBanded(banded: boolean): void {
    this.uniforms.bands.value = banded ? PIXEL_BANDS : 0;
  }
}
