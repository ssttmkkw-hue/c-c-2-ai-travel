/**
 * 调色板 = 一张地图卡的“氛围”。所有场景颜色都应来自调色板，不要在模型里写死颜色。
 * 规则详见 docs/ART_GUIDE.md
 */
export interface Palette {
  /** 天空 / 背景色 */
  sky: string;
  /** 雾色（通常接近 sky，远景会融进去） */
  fog: string;
  fogNear: number;
  fogFar: number;
  /** 太阳光颜色与强度 */
  sun: string;
  sunIntensity: number;
  /** 半球光：天空侧 / 地面侧 */
  skyLight: string;
  groundLight: string;
  ambientIntensity: number;
  /** 地面主色 */
  ground: string;
  /** 建筑/大型物体主色（3~5 个） */
  primary: string[];
  /** 点缀色：招牌、灯笼、旗帜等（2~4 个） */
  accent: string[];
  /** 植被色（2~3 个） */
  foliage: string[];
  /** 描边颜色（一般是很深的同色系，而不是纯黑） */
  outline: string;
}

/** 从数组中按索引取色（自动循环），方便 kit.box(..., pick(p.primary, i)) */
export function pick(colors: string[], i: number): string {
  return colors[((i % colors.length) + colors.length) % colors.length];
}
