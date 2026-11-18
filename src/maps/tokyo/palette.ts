import type { Palette, TimeOfDay } from '@/render/palette';

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

/** 默认调色板是黄昏。这里只补清晨和正午，太阳 y 都高于 0.2 */
export const times: { dawn: TimeOfDay; noon: TimeOfDay } = {
  dawn: {
    sky: '#f2c2a8',
    skyTop: '#6f8ec4',
    cloudDensity: 0.42,
    fog: '#f6d2c4',
    fogNear: 32,
    fogFar: 108,
    sun: '#ffd0a4',
    sunIntensity: 1.9,
    sunDirection: [-0.55, 0.34, 0.48],
    skyLight: '#ffd8c4',
    groundLight: '#5a4a68',
    ambientIntensity: 1.2,
    exposure: 1.02,
  },
  noon: {
    sky: '#8ec8f2',
    skyTop: '#3d7ed6',
    cloudDensity: 0.32,
    fog: '#e7eef6',
    fogNear: 42,
    fogFar: 125,
    sun: '#fff6e4',
    sunIntensity: 2.5,
    sunDirection: [0.2, 0.92, 0.25],
    skyLight: '#d7ecff',
    groundLight: '#cbb6a2',
    ambientIntensity: 1.12,
    exposure: 1.06,
  },
};
