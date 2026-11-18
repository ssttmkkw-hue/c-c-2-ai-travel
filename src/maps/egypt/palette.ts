import type { Palette, TimeOfDay } from '@/render/palette';

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

/** 默认调色板是正午。补黄昏和清晨 */
export const times: { dusk: TimeOfDay; dawn: TimeOfDay } = {
  dusk: {
    sky: '#f0a070',
    skyTop: '#c45a4a',
    cloudDensity: 0.22,
    fog: '#f6c89a',
    fogNear: 40,
    fogFar: 130,
    sun: '#ffb070',
    sunIntensity: 2.1,
    sunDirection: [0.7, 0.3, 0.35],
    skyLight: '#ffd0a8',
    groundLight: '#8a5a3a',
    ambientIntensity: 1.15,
    exposure: 1.02,
  },
  dawn: {
    sky: '#f2c9a0',
    skyTop: '#7aa0c8',
    cloudDensity: 0.18,
    fog: '#f6e0c4',
    fogNear: 48,
    fogFar: 140,
    sun: '#ffe0b8',
    sunIntensity: 2.0,
    sunDirection: [-0.5, 0.36, 0.45],
    skyLight: '#ffe4c8',
    groundLight: '#a07848',
    ambientIntensity: 1.18,
    exposure: 1.0,
  },
};
