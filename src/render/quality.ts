/**
 * 画质档位 + 渲染分辨率计算（纯函数，不依赖 DOM / three）。
 *
 * 两种画面风格：
 * - 'pixel' 像素风：场景按「虚拟分辨率」渲染，再用**整数倍**最近邻放大到屏幕物理像素。
 *   虚拟分辨率由「目标短边」决定，和屏幕 DPR 无关 —— 1080p、4K、Retina 上看到的像素颗粒观感一致。
 * - 'hd' 高清：按屏幕物理像素渲染（倍率受画质档位限制）。只有高画质才开 MSAA。
 *
 * Engine 用 computeView() 得到 RenderView；World 用 shadowConfig() 配置阴影。
 */
import type { PixelDensity, Quality, RenderMode } from '@/core/settings';

export interface QualityPreset {
  /** 高清模式：渲染倍率上限（相对 CSS 像素，实际 = min(devicePixelRatio, 上限)） */
  hdMaxPixelRatio: number;
  /**
   * 高清模式的 MSAA 采样数（0 = 关）。
   * 只在「高清 + 高画质」打开：像素风是低分辨率最近邻放大，MSAA 几乎看不出来，还会多一次全屏 resolve。
   */
  hdSamples: number;
}

export const QUALITY: Record<Quality, QualityPreset> = {
  low: { hdMaxPixelRatio: 1, hdSamples: 0 },
  medium: { hdMaxPixelRatio: 1.5, hdSamples: 0 },
  high: { hdMaxPixelRatio: 2, hdSamples: 4 },
};

/**
 * 地面细节 / 飘落粒子的数量系数。
 * 低档关掉（这些小东西主要是填充率），中档一半，高档全开。
 */
export const DETAIL_SCALE: Record<Quality, number> = { low: 0, medium: 0.5, high: 1 };

interface ShadowLevel {
  mapSize: number;
  filtered: boolean;
}

/**
 * 阴影贴图边长。
 * 像素风内部分辨率最多约 960×540，4096 的阴影图填不满、又很贵（软件渲染下阴影曾占约四成帧时间）。
 * 高清·高仍用 4096：那一档是显式选择，近处要更细的柔影。
 */
const PIXEL_SHADOW: Record<Quality, ShadowLevel> = {
  low: { mapSize: 1024, filtered: false },
  medium: { mapSize: 1024, filtered: true },
  high: { mapSize: 2048, filtered: true },
};
const HD_SHADOW: Record<Quality, ShadowLevel> = {
  low: { mapSize: 1024, filtered: false },
  medium: { mapSize: 2048, filtered: true },
  high: { mapSize: 4096, filtered: true },
};

export interface ShadowConfig {
  mapSize: number;
  /** true = 采样时做 PCF 过滤（轮廓平滑）；false = 直接硬采样（最省，边缘有阴影贴图像素的锯齿） */
  filtered: boolean;
  /** true = 过滤后再二值化成硬边（像素风）；false = 保留柔和的半影（高清） */
  hardEdge: boolean;
}

/**
 * 阴影配置。
 * - 像素风：过滤 + 二值化。柔和的半影在低分辨率下是一圈杂色渐变，显得糊；直接硬采样又有锯齿梳子边。
 *   先过滤再按 0.5 切一刀，得到「轮廓平滑的硬边影子」。
 * - 高清：中 / 高档保留柔和半影当抗锯齿。
 * - 低档：两种风格都直接硬采样。
 */
export function shadowConfig(s: ViewInput): ShadowConfig {
  const q = (s.renderMode === 'pixel' ? PIXEL_SHADOW : HD_SHADOW)[s.quality];
  return { mapSize: q.mapSize, filtered: q.filtered, hardEdge: s.renderMode === 'pixel' };
}

/** 像素风：虚拟分辨率的目标短边（虚拟像素）。实际值会取到最接近的整数倍放大 */
export const PIXEL_TARGET: Record<PixelDensity, number> = { coarse: 270, normal: 360, fine: 540 };

/** 物理短边不小于这个值时，像素风至少放大 2 倍（否则就不是像素风了） */
const PIXEL_MIN_SHORT_FOR_2X = 480;

/** 描边粗细：像素风固定 1 个虚拟像素；高清按内部分辨率短边折算，观感和像素风「标准」档接近 */
const OUTLINE_PX_PIXEL = 1;
const HD_OUTLINE_REF_SHORT = 450;
const HD_OUTLINE_MIN_PX = 1.5;

export interface RenderView {
  mode: RenderMode;
  /** 画布后备缓冲尺寸（物理像素） */
  canvasWidth: number;
  canvasHeight: number;
  /** 场景内部渲染分辨率 */
  width: number;
  height: number;
  /** 内部 1 像素 = 多少物理像素。像素风下一定是整数 */
  scale: number;
  /** MSAA 采样数（像素风恒为 0，保持硬边） */
  samples: number;
  /** 描边粗细（内部像素） */
  outlinePx: number;
  /** 计算时的 devicePixelRatio（仅供显示 / 调试） */
  dpr: number;
}

export interface ViewInput {
  renderMode: RenderMode;
  pixelDensity: PixelDensity;
  quality: Quality;
}

/**
 * @param canvasWidth  画布物理像素宽（CSS 宽 × devicePixelRatio，取整）
 * @param canvasHeight 画布物理像素高
 */
export function computeView(canvasWidth: number, canvasHeight: number, dpr: number, s: ViewInput): RenderView {
  const cw = Math.max(1, Math.round(canvasWidth));
  const ch = Math.max(1, Math.round(canvasHeight));
  const short = Math.min(cw, ch);

  if (s.renderMode === 'pixel') {
    const min = short >= PIXEL_MIN_SHORT_FOR_2X ? 2 : 1;
    const scale = Math.max(min, Math.round(short / PIXEL_TARGET[s.pixelDensity]));
    // 向上取整：内部画面比屏幕多出不到 1 个虚拟像素，放大后右/下边缘被裁掉，保证每个像素块都是 scale×scale
    return {
      mode: 'pixel',
      canvasWidth: cw,
      canvasHeight: ch,
      width: Math.ceil(cw / scale),
      height: Math.ceil(ch / scale),
      scale,
      samples: 0,
      outlinePx: OUTLINE_PX_PIXEL,
      dpr,
    };
  }

  const q = QUALITY[s.quality];
  const ratio = Math.min(dpr, q.hdMaxPixelRatio);
  const scale = Math.max(1, dpr / ratio);
  const width = Math.max(1, Math.round(cw / scale));
  const height = Math.max(1, Math.round(ch / scale));
  return {
    mode: 'hd',
    canvasWidth: cw,
    canvasHeight: ch,
    width,
    height,
    scale,
    samples: q.hdSamples,
    outlinePx: Math.max(HD_OUTLINE_MIN_PX, Math.min(width, height) / HD_OUTLINE_REF_SHORT),
    dpr,
  };
}

export function sameView(a: RenderView | null, b: RenderView): boolean {
  return (
    !!a &&
    a.mode === b.mode &&
    a.canvasWidth === b.canvasWidth &&
    a.canvasHeight === b.canvasHeight &&
    a.width === b.width &&
    a.height === b.height &&
    a.scale === b.scale &&
    a.samples === b.samples &&
    a.outlinePx === b.outlinePx
  );
}
