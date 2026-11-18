/**
 * 渐变天空：一个永远罩在相机外面的穹顶（1 次 draw call）。
 *
 * - 地平线颜色 = 雾色，往上先过渡到天空主色、再到天顶色 → 远景被雾吃掉时正好融进地平线，没有「雾和天空两个颜色」的接缝
 * - 地平线以下也是雾色（地面在雾里消失的地方看不出边）
 * - 朝太阳的方向有一圈光晕和一个硬边的太阳圆盘
 * - 云画在同一张穹顶上（0 次额外绘制）：慢速平移，像素风下是色块，高清下边缘稍软
 * - 像素风下把渐变切成色带（干净的色阶，不出现低分辨率下的杂色渐变）；高清下是平滑渐变
 *
 * 颜色全部来自调色板（skyTop / sky / fog / sun）。云色由雾色提亮，疏密看 cloudDensity。
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
    time: { value: 0 },
    cloudDensity: { value: 0.4 },
    cloudColor: { value: new THREE.Color() },
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
        uniform float time;
        uniform float cloudDensity;
        uniform vec3 cloudColor;
        varying vec3 vDir;
        const float MID = 0.3;

        float hash( vec2 p ) {
          return fract( sin( dot( p, vec2( 127.1, 311.7 ) ) ) * 43758.5453 );
        }
        float noise( vec2 p ) {
          vec2 i = floor( p );
          vec2 f = fract( p );
          // 像素风：格子之间不插值，云是一块一块的
          float u = bands > 0.0 ? step( 0.5, f.x ) : f.x * f.x * ( 3.0 - 2.0 * f.x );
          float v = bands > 0.0 ? step( 0.5, f.y ) : f.y * f.y * ( 3.0 - 2.0 * f.y );
          return mix( mix( hash( i ), hash( i + vec2( 1.0, 0.0 ) ), u ),
                      mix( hash( i + vec2( 0.0, 1.0 ) ), hash( i + vec2( 1.0, 1.0 ) ), u ), v );
        }

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

          // 云：投影到地平线上方的一块平面上，沿 X 慢慢飘。太阳圆盘后面再画，不会被云吃掉
          if ( cloudDensity > 0.001 && dir.y > 0.04 ) {
            // 默认镜头略俯视，看得见的天空仰角不高，云带要压低才能入画
            float band = smoothstep( 0.03, 0.1, dir.y ) * ( 1.0 - smoothstep( 0.55, 0.92, dir.y ) );
            vec2 p = dir.xz / ( dir.y * 0.7 + 0.28 );
            p.x += time * 0.03;
            if ( bands > 0.0 ) p = floor( p * 18.0 ) / 18.0;
            float n = noise( p * 2.6 );
            if ( bands <= 0.0 ) n = n * 0.65 + noise( p * 2.2 + 3.7 ) * 0.35;
            float thresh = mix( 0.8, 0.46, cloudDensity );
            float m = smoothstep( thresh, thresh + ( bands > 0.0 ? 0.02 : 0.16 ), n ) * band;
            if ( bands > 0.0 ) m = step( 0.5, m );
            col = mix( col, cloudColor, m * 0.92 );
          }

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
   * @param cloudDensity 云的疏密，0~1。缺省 0.4
   */
  set(top: THREE.ColorRepresentation, mid: THREE.ColorRepresentation, horizon: THREE.ColorRepresentation, sun: THREE.ColorRepresentation, sunDir: THREE.Vector3, cloudDensity = 0.4): void {
    this.uniforms.topColor.value.set(top);
    this.uniforms.midColor.value.set(mid);
    this.uniforms.horizonColor.value.set(horizon);
    this.uniforms.sunColor.value.set(sun);
    this.uniforms.sunDir.value.copy(sunDir).normalize();
    this.uniforms.cloudDensity.value = THREE.MathUtils.clamp(cloudDensity, 0, 1);
    // 云色 = 雾色往白里提一截，再掺一点天空色，避免每张图单独配一个云的色值
    const cloud = new THREE.Color(horizon);
    cloud.lerp(new THREE.Color(mid), 0.08);
    cloud.r += (1 - cloud.r) * 0.72;
    cloud.g += (1 - cloud.g) * 0.72;
    cloud.b += (1 - cloud.b) * 0.72;
    this.uniforms.cloudColor.value.copy(cloud);
  }

  /** 云的漂移。由 World 每帧用引擎时间调用；画面冻结时时间不变，云就停住 */
  setTime(time: number): void {
    this.uniforms.time.value = time;
  }

  /** 像素风用色带，高清用平滑渐变 */
  setBanded(banded: boolean): void {
    this.uniforms.bands.value = banded ? PIXEL_BANDS : 0;
  }
}
