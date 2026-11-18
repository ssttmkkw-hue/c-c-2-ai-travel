import type { Palette, TimeOfDay } from '@/render/palette';

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

/** 默认调色板是清晨。补黄昏和正午 */
export const times: { dusk: TimeOfDay; noon: TimeOfDay } = {
  dusk: {
    sky: '#f0b89a',
    skyTop: '#7a6aa8',
    cloudDensity: 0.55,
    fog: '#f3d2c0',
    fogNear: 34,
    fogFar: 105,
    sun: '#ffc49a',
    sunIntensity: 1.85,
    sunDirection: [0.58, 0.3, -0.4],
    skyLight: '#ffd0c0',
    groundLight: '#6a5348',
    ambientIntensity: 1.15,
    exposure: 1.0,
  },
  noon: {
    sky: '#9fd0f2',
    skyTop: '#3f86d6',
    cloudDensity: 0.28,
    fog: '#e4eef6',
    fogNear: 44,
    fogFar: 120,
    sun: '#fff8ea',
    sunIntensity: 2.4,
    sunDirection: [0.22, 0.9, 0.28],
    skyLight: '#d5ebff',
    groundLight: '#c8b89a',
    ambientIntensity: 1.08,
    exposure: 1.05,
  },
};
