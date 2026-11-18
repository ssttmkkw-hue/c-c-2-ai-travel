/**
 * 玩家可调设置。持久化到 localStorage（读写失败时静默回退到默认值）。
 * 修改设置一律调用 updateSettings()，它会广播 'settings:changed'。
 *
 * 画面相关的三个设置怎么换算成实际分辨率 / 阴影，见 src/render/quality.ts。
 */
import { bus } from './events';

/** 画面风格：'pixel' 像素风（低分辨率渲染 + 整数倍放大）· 'hd' 高清（原生分辨率 + 抗锯齿） */
export type RenderMode = 'pixel' | 'hd';
/** 像素风的颗粒粗细：复古（粗）/ 标准 / 精细（只在 renderMode = 'pixel' 时有效） */
export type PixelDensity = 'coarse' | 'normal' | 'fine';
/** 画质档位：阴影分辨率与过滤、高清模式的渲染倍率与抗锯齿 */
export type Quality = 'low' | 'medium' | 'high';

export const RENDER_MODES: readonly RenderMode[] = ['pixel', 'hd'];
export const PIXEL_DENSITIES: readonly PixelDensity[] = ['coarse', 'normal', 'fine'];
export const QUALITIES: readonly Quality[] = ['low', 'medium', 'high'];

export interface Settings {
  renderMode: RenderMode;
  pixelDensity: PixelDensity;
  quality: Quality;
  /** 是否显示描边 */
  outline: boolean;
  /** 鼠标灵敏度 */
  mouseSensitivity: number;
}

const KEY = 'ai-travel:settings';

function isTouchDevice(): boolean {
  try {
    return window.matchMedia?.('(pointer: coarse)').matches ?? false;
  } catch {
    return false;
  }
}

/** 手机 / 平板默认降一档画质（性能弱的降两档）；桌面默认最高 */
function defaultQuality(touch: boolean): Quality {
  if (!touch) return 'high';
  const nav = navigator as Navigator & { deviceMemory?: number };
  const weak = (nav.hardwareConcurrency ?? 8) <= 4 || (nav.deviceMemory ?? 8) <= 4;
  return weak ? 'low' : 'medium';
}

function defaults(): Settings {
  const touch = isTouchDevice();
  return {
    renderMode: 'pixel',
    // 手机屏幕像素密度高，「精细」档的像素块小到看不出像素风，默认用「标准」
    pixelDensity: touch ? 'normal' : 'fine',
    quality: defaultQuality(touch),
    outline: true,
    mouseSensitivity: 1,
  };
}

function oneOf<T extends string>(v: unknown, list: readonly T[], fallback: T): T {
  return list.includes(v as T) ? (v as T) : fallback;
}

/** 只认识的字段才读进来；类型不对的回退默认值 */
function sanitize(raw: Record<string, unknown>, d: Settings): Settings {
  let pixelDensity = oneOf(raw.pixelDensity, PIXEL_DENSITIES, d.pixelDensity);
  // 旧版存档只有 pixelSize（CSS 像素 / 虚拟像素）。旧默认值 4 正是“太糊”的来源，不沿用；
  // 只有玩家明确调到很细 / 很粗时才迁移成对应档位。
  if (raw.pixelDensity === undefined && typeof raw.pixelSize === 'number') {
    if (raw.pixelSize <= 2) pixelDensity = 'fine';
    else if (raw.pixelSize >= 6) pixelDensity = 'coarse';
  }
  const sens = typeof raw.mouseSensitivity === 'number' && isFinite(raw.mouseSensitivity) ? raw.mouseSensitivity : d.mouseSensitivity;
  return {
    renderMode: oneOf(raw.renderMode, RENDER_MODES, d.renderMode),
    pixelDensity,
    quality: oneOf(raw.quality, QUALITIES, d.quality),
    outline: typeof raw.outline === 'boolean' ? raw.outline : d.outline,
    mouseSensitivity: Math.min(3, Math.max(0.1, sens)),
  };
}

function load(): Settings {
  const d = defaults();
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') return sanitize(parsed as Record<string, unknown>, d);
    }
  } catch {
    /* ignore */
  }
  return d;
}

let current: Settings = load();

export function getSettings(): Readonly<Settings> {
  return current;
}

export function updateSettings(patch: Partial<Settings>): void {
  current = sanitize({ ...current, ...patch }, current);
  try {
    localStorage.setItem(KEY, JSON.stringify(current));
  } catch {
    /* ignore */
  }
  bus.emit('settings:changed', current);
}
