import type { Palette } from '@/render/palette';

export const palette: Palette = {
  sky: '#9fd3e8',
  // skyTop: '#5fa8e0',            // 可选：天顶色（天空从地平线的 fog 渐变到 sky 再到 skyTop）
  // sunDirection: [30, 50, 20],   // 可选：指向太阳的方向，y 越小影子越长
  fog: '#9fd3e8',
  fogNear: 40,
  fogFar: 110,
  sun: '#fff4e0',
  sunIntensity: 2.2,
  skyLight: '#cfe8ff',
  groundLight: '#6b5a4a',
  ambientIntensity: 1.2,
  ground: '#8fbf6a',
  primary: ['#e8dcc8', '#c9b79c', '#a3907a'],
  accent: ['#e05a47', '#f2c14e'],
  foliage: ['#5f9e4f', '#3f7a3a'],
  outline: '#2a2030',
};
