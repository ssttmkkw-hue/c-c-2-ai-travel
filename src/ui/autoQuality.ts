/**
 * 进第一张图之后，用大约 2.5 秒「有效帧间隔」的中位数估帧率。
 * 明显低于 30fps 就沿梯子降一步，并提示一次。
 *
 * 梯子（只走一步，不连降）：
 * - 高 → 中 → 低画质
 * - 已经是低画质、且是像素风：像素颗粒往复古降一级（精细 → 标准 → 复古）
 *   这一步只改 pixelDensity，不写 qualityManual
 *
 * 不插手的情况：
 * - 地址栏 `?autoquality=0`（无头截图 / 性能测试，当次有效，不写存档）
 * - 设置里关掉了「自动降低画质」
 * - 玩家已经手动改过画质
 * - 已经自动降过一次（只降一次）
 *
 * 标签页在后台时 rAF 会暂停。这段时间不计入采样；出现超过 1 秒的间隔就丢掉，
 * 避免切回来后被算成大约 0 帧并写入 autoQualityDone。
 */
import { bus } from '@/core/events';
import { getSettings, updateSettings, type PixelDensity, type Quality, type Settings } from '@/core/settings';
import { coarserPixelDensity } from '@/render/quality';
import './autoQuality.css';

const TOAST_KEY = 'ai-travel:auto-quality-toast';
/** 低于这个值才算「明显不到 30」。躲开 28~31 的测量抖动 */
const FPS_LIMIT = 27;
const WARMUP_MS = 400;
/** 累计的有效帧时间，不含后台和超长间隔 */
const SAMPLE_MS = 2500;
/** 比这更长的一帧视为切后台或调试器暂停，不计入中位数 */
const MAX_GAP_MS = 1000;
/** 墙钟超时仍凑不满有效采样（一直卡在后台）就整段重来 */
const ABORT_MS = 12000;

const NEXT_QUALITY: Record<Quality, Quality | null> = { high: 'medium', medium: 'low', low: null };
const QUALITY_LABEL: Record<Quality, string> = { high: '高', medium: '中', low: '低' };
const DENSITY_LABEL: Record<PixelDensity, string> = { fine: '精细', normal: '标准', coarse: '复古' };

type Drop =
  | { kind: 'quality'; from: Quality; to: Quality }
  | { kind: 'density'; from: PixelDensity; to: PixelDensity };

export function autoQualityBlockedByUrl(): boolean {
  try {
    const v = new URLSearchParams(window.location.search).get('autoquality');
    return v === '0' || v === 'false' || v === 'off';
  } catch {
    return false;
  }
}

function nextDrop(s: Settings): Drop | null {
  const quality = NEXT_QUALITY[s.quality];
  if (quality) return { kind: 'quality', from: s.quality, to: quality };
  if (s.renderMode !== 'pixel') return null;
  const density = coarserPixelDensity(s.pixelDensity);
  if (!density) return null;
  return { kind: 'density', from: s.pixelDensity, to: density };
}

export function mountAutoQuality(root: HTMLElement): void {
  if (autoQualityBlockedByUrl()) return;
  let armed = false;
  bus.on('map:loaded', () => {
    if (armed) return;
    armed = true;
    const s = getSettings();
    if (!s.autoQuality || s.qualityManual || s.autoQualityDone) return;
    if (!nextDrop(s)) return;
    window.setTimeout(() => sampleAndMaybeDrop(root), WARMUP_MS);
  });
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid];
  return (sorted[mid - 1] + sorted[mid]) / 2;
}

function sampleAndMaybeDrop(root: HTMLElement): void {
  const s0 = getSettings();
  if (!s0.autoQuality || s0.qualityManual || s0.autoQualityDone || !nextDrop(s0)) return;

  if (document.hidden) {
    const wait = (): void => {
      if (document.hidden) return;
      document.removeEventListener('visibilitychange', wait);
      sampleAndMaybeDrop(root);
    };
    document.addEventListener('visibilitychange', wait);
    return;
  }

  const intervals: number[] = [];
  let last = 0;
  let acc = 0;
  let stopped = false;
  let raf = 0;

  const stop = (): void => {
    if (stopped) return;
    stopped = true;
    cancelAnimationFrame(raf);
    document.removeEventListener('visibilitychange', onHidden);
    window.clearTimeout(abortTimer);
  };

  const restart = (): void => {
    if (stopped) return;
    stop();
    sampleAndMaybeDrop(root);
  };

  const onHidden = (): void => {
    if (document.hidden) restart();
  };
  document.addEventListener('visibilitychange', onHidden);

  const abortTimer = window.setTimeout(restart, ABORT_MS);

  const tick = (now: number): void => {
    if (stopped) return;
    if (document.hidden) {
      restart();
      return;
    }
    if (last === 0) {
      last = now;
      raf = requestAnimationFrame(tick);
      return;
    }
    const dt = now - last;
    last = now;
    if (dt <= 0 || dt > MAX_GAP_MS) {
      // 丢掉跨后台的那一帧，前面已经量到的有效间隔也作废，整段重来
      restart();
      return;
    }
    intervals.push(dt);
    acc += dt;
    if (acc < SAMPLE_MS) {
      raf = requestAnimationFrame(tick);
      return;
    }
    stop();
    const fps = 1000 / median(intervals);
    applyDrop(root, fps);
  };
  raf = requestAnimationFrame(tick);
}

function applyDrop(root: HTMLElement, fps: number): void {
  const s = getSettings();
  const drop = nextDrop(s);
  if (!s.autoQuality || s.qualityManual || s.autoQualityDone || !drop || fps >= FPS_LIMIT) return;
  const rounded = Math.round(fps);
  if (drop.kind === 'quality') {
    updateSettings({ quality: drop.to, autoQualityDone: true }, 'auto');
    showToast(
      root,
      `帧率偏低（约 ${rounded} 帧），已自动把画质从「${QUALITY_LABEL[drop.from]}」降到「${QUALITY_LABEL[drop.to]}」。可以在设置里改回来。`,
    );
    return;
  }
  updateSettings({ pixelDensity: drop.to, autoQualityDone: true }, 'auto');
  showToast(
    root,
    `帧率偏低（约 ${rounded} 帧），已自动把分辨率从「${DENSITY_LABEL[drop.from]}」降到「${DENSITY_LABEL[drop.to]}」。可以在设置里改回来。`,
  );
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
