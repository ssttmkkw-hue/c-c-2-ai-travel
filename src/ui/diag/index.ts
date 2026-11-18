/**
 * 真机诊断面板。只通过 bus 拿数据，不 import Engine。
 * 默认隐藏；?diag=1 或设置里的「性能信息」打开。不是弹窗，不发 ui:modal。
 */
import { bus } from '@/core/events';
import { getSettings, updateSettings, type Quality, type RenderMode, type Settings } from '@/core/settings';
import type { RenderView } from '@/render/quality';
import './diag.css';

const SETTINGS_KEY = 'ai-travel:settings';
const PRESETS: { preset: string; patch: Pick<Settings, 'renderMode' | 'quality'> }[] = [
  { preset: 'pixel-high', patch: { renderMode: 'pixel', quality: 'high' } },
  { preset: 'hd-high', patch: { renderMode: 'hd', quality: 'high' } },
  { preset: 'pixel-low', patch: { renderMode: 'pixel', quality: 'low' } },
];

const MODE_LABEL: Record<RenderMode, string> = { pixel: '像素风', hd: '高清' };
const DENSITY_LABEL = { coarse: '复古', normal: '标准', fine: '精细' } as const;
const QUALITY_LABEL: Record<Quality, string> = { low: '低', medium: '中', high: '高' };

type Sample = { fps: number; worstMs: number; calls: number; triangles: number; gpu: string };

let toggleImpl: (() => void) | null = null;

/** 设置面板调用。挂载前点了也无事 */
export function toggleDiag(): void {
  toggleImpl?.();
}

export function mountDiag(root: HTMLElement): void {
  const panel = document.createElement('div');
  panel.className = 'diag';
  panel.hidden = true;
  panel.innerHTML = `
    <p class="diag-line" data-fps>帧率 采样中</p>
    <p class="diag-line" data-res>分辨率 采样中</p>
    <p class="diag-line" data-style></p>
    <p class="diag-line" data-draw>绘制 采样中（不含阴影遍）</p>
    <p class="diag-line" data-gpu>显卡 采样中</p>
    <p class="diag-note">顶到 60 / 120 说明还有余量</p>
    <div class="diag-actions">
      <button type="button" data-run disabled>跑一遍测试</button>
      <button type="button" data-copy>复制结果</button>
      <button type="button" data-close>关闭</button>
    </div>
    <textarea class="diag-out" data-out readonly spellcheck="false"></textarea>
  `;
  root.appendChild(panel);

  const fpsEl = panel.querySelector('[data-fps]') as HTMLElement;
  const resEl = panel.querySelector('[data-res]') as HTMLElement;
  const styleEl = panel.querySelector('[data-style]') as HTMLElement;
  const drawEl = panel.querySelector('[data-draw]') as HTMLElement;
  const gpuEl = panel.querySelector('[data-gpu]') as HTMLElement;
  const runBtn = panel.querySelector('[data-run]') as HTMLButtonElement;
  const out = panel.querySelector('[data-out]') as HTMLTextAreaElement;

  let open = false;
  let sample: Sample | null = null;
  let view: RenderView | null = null;
  let mapId = '';
  let gpu = '未知';
  let running = false;
  let benchReady = false;
  let lockArmed = false;

  function paint(): void {
    const s = getSettings();
    if (sample) {
      fpsEl.textContent = `帧率 ${sample.fps.toFixed(1)} · 最差 ${sample.worstMs.toFixed(1)} ms`;
      drawEl.textContent = `绘制 ${sample.calls} · 三角 ${sample.triangles}（不含阴影遍）`;
      gpuEl.textContent = `显卡 ${sample.gpu} · devicePixelRatio ${devicePixelRatioLabel()}`;
    }
    if (view) {
      resEl.textContent = `内部 ${view.width}×${view.height} · 放大 ${formatScale(view.scale)}`;
    }
    const grain = s.renderMode === 'pixel' ? ` · ${DENSITY_LABEL[s.pixelDensity]}` : '';
    styleEl.textContent = `${MODE_LABEL[s.renderMode]}${grain} · ${QUALITY_LABEL[s.quality]}`;
  }

  function setOpen(next: boolean): void {
    open = next;
    panel.hidden = !open;
    if (open) paint();
  }

  toggleImpl = () => setOpen(!open);

  panel.querySelector('[data-close]')!.addEventListener('click', () => setOpen(false));
  panel.querySelector('[data-copy]')!.addEventListener('click', () => copyResult(out));
  runBtn.addEventListener('click', () => {
    if (!benchReady || running) return;
    void runBench();
  });

  bus.on('perf:sample', (s) => {
    sample = s;
    gpu = s.gpu;
    if (open) paint();
  });
  bus.on('render:view', (v) => {
    view = v;
    if (open) paint();
  });
  bus.on('settings:changed', () => {
    if (open) paint();
  });
  bus.on('map:loaded', ({ card }) => {
    mapId = card.id;
    if (lockArmed) return;
    lockArmed = true;
    runBtn.disabled = true;
    window.setTimeout(() => {
      benchReady = true;
      if (!running) runBtn.disabled = false;
    }, 6000);
  });

  if (diagRequested()) setOpen(true);

  async function runBench(): Promise<void> {
    running = true;
    runBtn.disabled = true;
    runBtn.textContent = '测试中…';
    const snapshot = { ...getSettings() };
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(SETTINGS_KEY);
    } catch {
      stored = null;
    }
    const rows: {
      preset: string;
      view: string;
      fps: number;
      worstMs: number;
      calls: number;
      triangles: number;
    }[] = [];
    try {
      for (const item of PRESETS) {
        updateSettings(item.patch, 'auto');
        await wait(1500);
        const batch = await collectSamples(4, 8000);
        const v = view;
        rows.push({
          preset: item.preset,
          view: v ? `${v.width}x${v.height}@${scaleToken(v.scale)}` : '',
          fps: round1(medianOf(batch.map((s) => s.fps))),
          worstMs: round1(medianOf(batch.map((s) => s.worstMs))),
          calls: Math.round(medianOf(batch.map((s) => s.calls))),
          triangles: Math.round(medianOf(batch.map((s) => s.triangles))),
        });
      }
      const report = {
        map: mapId,
        ua: navigator.userAgent,
        dpr: window.devicePixelRatio || 1,
        screen: [window.screen?.width ?? window.innerWidth, window.screen?.height ?? window.innerHeight],
        gpu,
        rows,
      };
      out.value = JSON.stringify(report);
    } finally {
      updateSettings(snapshot, 'auto');
      restoreStored(stored);
      running = false;
      runBtn.textContent = '跑一遍测试';
      runBtn.disabled = !benchReady;
      paint();
    }
  }
}

function diagRequested(): boolean {
  try {
    return new URLSearchParams(window.location.search).get('diag') === '1';
  } catch {
    return false;
  }
}

function devicePixelRatioLabel(): string {
  const dpr = window.devicePixelRatio || 1;
  return Number.isInteger(dpr) ? String(dpr) : dpr.toFixed(2);
}

function scaleToken(scale: number): string {
  const rounded = Math.round(scale);
  return Math.abs(scale - rounded) < 0.05 ? String(rounded) : scale.toFixed(2);
}

function formatScale(scale: number): string {
  return `${scaleToken(scale)}×`;
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function collectSamples(n: number, timeoutMs: number): Promise<Sample[]> {
  return new Promise((resolve) => {
    const got: Sample[] = [];
    let done = false;
    const off = bus.on('perf:sample', (s) => {
      got.push(s);
      if (got.length >= n) finish();
    });
    const timer = window.setTimeout(finish, timeoutMs);
    function finish(): void {
      if (done) return;
      done = true;
      window.clearTimeout(timer);
      off();
      resolve(got);
    }
  });
}

function medianOf(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  if (sorted.length % 2 === 1) return sorted[mid];
  return (sorted[mid - 1] + sorted[mid]) / 2;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function restoreStored(stored: string | null): void {
  try {
    if (stored == null) localStorage.removeItem(SETTINGS_KEY);
    else localStorage.setItem(SETTINGS_KEY, stored);
  } catch {
    /* 隐私模式写不进去时，内存里的设置已经由 updateSettings 恢复 */
  }
}

async function copyResult(out: HTMLTextAreaElement): Promise<void> {
  const text = out.value;
  try {
    if (!navigator.clipboard?.writeText) throw new Error('no clipboard');
    await navigator.clipboard.writeText(text);
  } catch {
    out.focus();
    out.select();
  }
}
