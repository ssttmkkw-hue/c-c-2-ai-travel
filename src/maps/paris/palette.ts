import type { Palette } from '@/render/palette';

/**
 * 巴黎：清晨薄雾。奶油白墙、灰蓝屋顶，红棚和金色是小面积点缀。
 * primary[0..2] 墙面，primary[3..4] 石板屋顶。雾比东京更近一点。
 */
export const palette: Palette = {
  sky: '#d4e2ee',
  skyTop: '#96bfea',
  cloudDensity: 0.48,
  fog: '#e7eef4',
  fogNear: 36,
  fogFar: 110,
  sun: '#fff4dc',
  sunIntensity: 2.15,
  sunDirection: [0.5, 0.6, 0.46], // 清晨：斜阳
  skyLight: '#e6f0f8',
  groundLight: '#c6b59a',
  ambientIntensity: 1.26,
  ground: '#c6c1b3',
  primary: ['#f7f2e7', '#ebe4d4', '#ddd2c0', '#8ea6b8', '#6d8496'],
  accent: ['#c4473a', '#e2b34a', '#6a90a8'],
  foliage: ['#7d9a68', '#3e6b48', '#a3b98a'],
  outline: '#1e2c3d',
};
