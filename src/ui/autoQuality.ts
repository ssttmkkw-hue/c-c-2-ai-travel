/**
 * 进第一张图之后量约 2.5 秒帧时间。明显低于 30fps 就自动降一档画质，并提示一次。
 *
 * 不插手的情况：
 * - 地址栏 `?autoquality=0`（无头截图 / 性能测试，当次有效，不写存档）
 * - 设置里关掉了「自动降低画质」
 * - 玩家已经手动改过画质
 * - 已经自动降过一档（只降一次）
 */
import { bus } from '@/core/events';
import { getSettings, updateSettings, type Quality } from '@/core/settings';
import './autoQuality.css';

const TOAST_KEY = 'ai-travel:auto-quality-toast';
/** 低于这个值才算「明显不到 30」。2 秒平均，躲开 28~31 的测量抖动 */
const FPS_LIMIT = 27;
const WARMUP_MS = 400;
const SAMPLE_MS = 2500;

const NEXT: Record<Quality, Quality | null> = { high: 'medium', medium: 'low', low: null };
const LABEL: Record<Quality, string> = { high: '高', medium: '中', low: '低' };

export function autoQualityBlockedByUrl(): boolean {
  try {
    const v = new URLSearchParams(window.location.search).get('autoquality');
    return v === '0' || v === 'false' || v === 'off';
  } catch {
    return false;
  }
}

export function mountAutoQuality(root: HTMLElement): void {
  if (autoQualityBlockedByUrl()) return;
  let armed = false;
  bus.on('map:loaded', () => {
    if (armed) return;
    armed = true;
    const s = getSettings();
    if (!s.autoQuality || s.qualityManual || s.autoQualityDone) return;
    if (NEXT[s.quality] === null) return;
    window.setTimeout(() => sampleAndMaybeDrop(root), WARMUP_MS);
  });
}

function sampleAndMaybeDrop(root: HTMLElement): void {
  const t0 = performance.now();
  let frames = 0;
  const tick = (): void => {
    frames++;
    const elapsed = performance.now() - t0;
    if (elapsed < SAMPLE_MS) {
      requestAnimationFrame(tick);
      return;
    }
    const fps = frames / (elapsed / 1000);
    const s = getSettings();
    const next = NEXT[s.quality];
    if (!s.autoQuality || s.qualityManual || s.autoQualityDone || !next || fps >= FPS_LIMIT) return;
    updateSettings({ quality: next, autoQualityDone: true }, 'auto');
    showToast(root, `帧率偏低（约 ${Math.round(fps)} 帧），已自动把画质从「${LABEL[s.quality]}」降到「${LABEL[next]}」。可以在设置里改回来。`);
  };
  requestAnimationFrame(tick);
}

function showToast(root: HTMLElement, text: string): void {
  try {
    if (localStorage.getItem(TOAST_KEY) === '1') return;
    localStorage.setItem(TOAST_KEY, '1');
  } catch {
    /* 存不了就照样提示这一次 */
  }
  const el = document.createElement('p');
  el.className = 'auto-quality-toast';
  el.textContent = text;
  root.appendChild(el);
  window.setTimeout(() => el.remove(), 5200);
}
