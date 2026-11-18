/**
 * 设置面板。没有弹窗时 P 直接打开，Esc 显示或藏起齿轮；设置在最上层时 P / Esc 关闭。
 * 滑块 / 分段选项的方向键不占用路由，聚焦时仍由浏览器自己调值。
 *
 * 画面设置：风格（像素风 / 高清）、像素颗粒（复古 / 标准 / 精细）、画质（低 / 中 / 高）。
 * 实际渲染分辨率由 Engine 算出后通过 'render:view' 广播，这里只负责显示。
 */
import { bus } from '@/core/events';
import { getSettings, updateSettings, type PixelDensity, type Quality, type RenderMode, type Settings } from '@/core/settings';
import { keys } from '@/core/ui';
import type { RenderView } from '@/render/quality';
import './settings.css';

type Choice<T extends string> = { value: T; label: string };

const MODES: Choice<RenderMode>[] = [
  { value: 'pixel', label: '像素风' },
  { value: 'hd', label: '高清' },
];
const DENSITIES: Choice<PixelDensity>[] = [
  { value: 'coarse', label: '复古' },
  { value: 'normal', label: '标准' },
  { value: 'fine', label: '精细' },
];
const QUALITIES: Choice<Quality>[] = [
  { value: 'low', label: '低' },
  { value: 'medium', label: '中' },
  { value: 'high', label: '高' },
];

/** 分段单选（原生 radio，方向键可切换） */
function segment<T extends string>(name: string, legend: string, choices: Choice<T>[]): string {
  const items = choices
    .map((c) => `<label class="settings-seg-item"><input type="radio" name="settings-${name}" value="${c.value}" /><span>${c.label}</span></label>`)
    .join('');
  return `
    <fieldset class="settings-seg" data-seg="${name}">
      <legend>${legend}</legend>
      <div class="settings-seg-items">${items}</div>
    </fieldset>`;
}

export function mountSettings(root: HTMLElement): void {
  const gear = document.createElement('button');
  gear.type = 'button';
  gear.className = 'settings-gear';
  gear.textContent = '⚙';
  gear.setAttribute('aria-label', '打开设置');
  gear.hidden = true;

  const overlay = document.createElement('div');
  overlay.className = 'settings';
  overlay.hidden = true;
  overlay.innerHTML = `
    <div class="settings-panel" role="dialog" aria-modal="true" aria-label="设置">
      <header class="settings-head">
        <div>
          <h1 class="settings-title">设置</h1>
          <p class="settings-sub">改动会立刻保存</p>
        </div>
        <button type="button" class="settings-close" data-close>关闭</button>
      </header>
      ${segment('renderMode', '画面风格', MODES)}
      ${segment('pixelDensity', '像素颗粒', DENSITIES)}
      ${segment('quality', '画质', QUALITIES)}
      <p class="settings-info" data-view></p>
      <label class="settings-check">
        <input data-outline type="checkbox" />
        <span>描边</span>
      </label>
      <label class="settings-check">
        <input data-auto-quality type="checkbox" />
        <span>帧率过低时自动降低画质</span>
      </label>
      <label class="settings-row">
        <span data-sens-label>鼠标灵敏度</span>
        <input data-sens type="range" min="0.3" max="2" step="0.1" />
      </label>
      <p class="settings-foot">P / Esc 关闭 · 选项和滑块可用方向键</p>
    </div>
  `;
  root.appendChild(gear);
  root.appendChild(overlay);

  const outline = overlay.querySelector('[data-outline]') as HTMLInputElement;
  const autoQuality = overlay.querySelector('[data-auto-quality]') as HTMLInputElement;
  const sens = overlay.querySelector('[data-sens]') as HTMLInputElement;
  const sensLabel = overlay.querySelector('[data-sens-label]') as HTMLElement;
  const viewInfo = overlay.querySelector('[data-view]') as HTMLElement;
  const densitySeg = overlay.querySelector('[data-seg="pixelDensity"]') as HTMLFieldSetElement;
  const radios = Array.from(overlay.querySelectorAll<HTMLInputElement>('.settings-seg input[type="radio"]'));

  let open = false;
  let view: RenderView | null = null;

  function paintView(): void {
    if (!view) {
      viewInfo.textContent = '';
      return;
    }
    const res = `${view.width}×${view.height}`;
    if (view.mode === 'pixel') {
      viewInfo.textContent = `当前渲染 ${res} · 每格 ${view.scale}×${view.scale} 屏幕像素`;
    } else {
      const aa = view.samples > 0 ? ` · 抗锯齿 ${view.samples}x` : '';
      viewInfo.textContent = `当前渲染 ${res}${aa}`;
    }
  }

  function paint(): void {
    const s = getSettings();
    const mouse = clamp(Math.round(s.mouseSensitivity * 10) / 10, 0.3, 2);
    for (const r of radios) {
      const key = r.name.replace('settings-', '') as keyof Settings;
      r.checked = s[key] === r.value;
    }
    // 高清模式下没有“像素颗粒”
    densitySeg.disabled = s.renderMode !== 'pixel';
    outline.checked = s.outline;
    autoQuality.checked = s.autoQuality;
    sens.value = String(mouse);
    sensLabel.textContent = `鼠标灵敏度 ${mouse.toFixed(1)}`;
    paintView();
  }

  function setOpen(next: boolean): void {
    if (open === next) return;
    open = next;
    overlay.hidden = !open;
    if (open) gear.hidden = true;
    bus.emit('ui:modal', { id: 'settings', open });
    if (open) paint();
  }

  for (const r of radios) {
    r.addEventListener('change', () => {
      if (!r.checked) return;
      const key = r.name.replace('settings-', '');
      // 值来自上面的 Choice 表；非法值会被 updateSettings 的校验丢弃
      updateSettings({ [key]: r.value } as Partial<Settings>);
    });
  }
  outline.addEventListener('change', () => {
    updateSettings({ outline: outline.checked });
  });
  autoQuality.addEventListener('change', () => {
    updateSettings({ autoQuality: autoQuality.checked });
  });
  sens.addEventListener('input', () => {
    updateSettings({ mouseSensitivity: Number(sens.value) });
  });

  gear.addEventListener('click', () => setOpen(true));
  overlay.querySelector('[data-close]')!.addEventListener('click', () => setOpen(false));

  bus.on('settings:changed', paint);
  bus.on('render:view', (v) => {
    view = v;
    paintView();
  });

  keys.bind('game', 'KeyP', () => setOpen(true));
  keys.bind('game', 'Escape', () => {
    gear.hidden = !gear.hidden;
  });
  keys.bind('settings', ['KeyP', 'Escape'], () => setOpen(false));

  paint();
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}
