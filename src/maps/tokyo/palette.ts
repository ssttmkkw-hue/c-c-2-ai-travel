import type { Palette } from '@/render/palette';

/** 东京：黄昏，樱花粉 + 霓虹紫 */
export const palette: Palette = {
  sky: '#f6b8c8',
  skyTop: '#a488e0',
  cloudDensity: 0.5,
  fog: '#f6b2c2',
  fogNear: 36,
  fogFar: 115,
  sun: '#ffd2b0',
  sunIntensity: 2.0,
  sunDirection: [0.62, 0.5, 0.42], // 黄昏：太阳低，影子长
  skyLight: '#ffd0e6',
  groundLight: '#4a3a6a',
  ambientIntensity: 1.3,
  ground: '#b7a9c9',
  primary: ['#efe3f0', '#d7c4e2', '#9d86c2', '#6f5a9e'],
  accent: ['#ff4f8b', '#7a5cff', '#ffcf5c', '#e2363c'],
  foliage: ['#ffb3cf', '#ff8fb8', '#6fa36b'],
  outline: '#2b1838',
};
