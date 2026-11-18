/**
 * 玩家可调设置。持久化到 localStorage（读写失败时静默回退到默认值）。
 * 修改设置一律调用 updateSettings()，它会广播 'settings:changed'。
 */
import { bus } from './events';

export interface Settings {
  /** 像素块大小（1 = 原生分辨率，越大越“像素”）。推荐 2~6 */
  pixelSize: number;
  /** 是否显示描边 */
  outline: boolean;
  /** 鼠标灵敏度 */
  mouseSensitivity: number;
}

const DEFAULTS: Settings = { pixelSize: 4, outline: true, mouseSensitivity: 1 };
const KEY = 'ai-travel:settings';

function load(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    /* ignore */
  }
  return { ...DEFAULTS };
}

let current: Settings = load();

export function getSettings(): Readonly<Settings> {
  return current;
}

export function updateSettings(patch: Partial<Settings>): void {
  current = { ...current, ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(current));
  } catch {
    /* ignore */
  }
  bus.emit('settings:changed', current);
}
