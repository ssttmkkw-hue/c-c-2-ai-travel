/**
 * 调色板 = 一张地图卡的“氛围”。所有场景颜色都应来自调色板，不要在模型里写死颜色。
 * 规则详见 docs/ART_GUIDE.md
 */
export interface Palette {
  /** 天空主色（天顶没单独配 skyTop 时，天顶也用它） */
  sky: string;
  /** 天顶色（可选）。天空渐变：地平线 fog → sky → 天顶 skyTop，一般比 sky 更深、更饱和 */
  skyTop?: string;
  /**
   * 云的疏密（可选，默认 0.4）。0 没有云，1 很密。
   * 云画在天空穹顶里，颜色由雾色提亮得到，不额外占绘制。
   */
  cloudDensity?: number;
  /** 雾色 = 天空地平线的颜色，远景会融进去 */
  fog: string;
  fogNear: number;
  fogFar: number;
  /** 太阳光颜色与强度 */
  sun: string;
  sunIntensity: number;
  /** 指向太阳的方向 [x, y, z]（可选，默认右后上方）。y 越小太阳越低、影子越长 */
  sunDirection?: [number, number, number];
  /** 曝光（可选，默认 1）。整体偏暗 / 偏亮时微调 */
  exposure?: number;
  /** 饱和度（可选，默认 1.15）。1 = 不调整 */
  saturation?: number;
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
