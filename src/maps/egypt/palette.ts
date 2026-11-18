import type { Palette } from '@/render/palette';

/** 吉萨：正午，沙金 + 天蓝 */
export const palette: Palette = {
  sky: '#7ec8f0',
  skyTop: '#3a93e6',
  cloudDensity: 0.16,
  fog: '#f3e6c0',
  fogNear: 56,
  fogFar: 150,
  sun: '#fff4d2',
  sunIntensity: 2.7,
  sunDirection: [0.34, 0.86, 0.3], // 正午：太阳高，影子短
  skyLight: '#c5e7ff',
  groundLight: '#c4a06a',
  ambientIntensity: 1.05,
  ground: '#e4c48a',
  primary: ['#f4e2b4', '#e2c48a', '#c9a25c', '#a67c45'],
  accent: ['#2a73c2', '#d4532c', '#f0d078', '#7a1f2b'],
  foliage: ['#6d9a40', '#3f6b2c', '#8aaa4a'],
  outline: '#3a2618',
};
