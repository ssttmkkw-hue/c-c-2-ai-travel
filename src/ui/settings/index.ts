/**
 * 设置面板。没有弹窗时 P 直接打开，Esc 显示或藏起齿轮；设置在最上层时 P / Esc 关闭。
 * 滑块方向键不占用路由，聚焦时仍由浏览器自己调值。
 */
import { bus } from '@/core/events';
import { getSettings, updateSettings } from '@/core/settings';
import { keys } from '@/core/ui';
import './settings.css';

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
      <label class="settings-row">
        <span data-pixel-label>像素大小</span>
        <input data-pixel type="range" min="1" max="8" step="1" />
      </label>
      <label class="settings-check">
        <input data-outline type="checkbox" />
        <span>描边</span>
      </label>
      <label class="settings-row">
        <span data-sens-label>鼠标灵敏度</span>
        <input data-sens type="range" min="0.3" max="2" step="0.1" />
      </label>
      <p class="settings-foot">P / Esc 关闭 · 滑块可用方向键</p>
    </div>
  `;
  root.appendChild(gear);
  root.appendChild(overlay);

  const pixel = overlay.querySelector('[data-pixel]') as HTMLInputElement;
  const pixelLabel = overlay.querySelector('[data-pixel-label]') as HTMLElement;
  const outline = overlay.querySelector('[data-outline]') as HTMLInputElement;
  const sens = overlay.querySelector('[data-sens]') as HTMLInputElement;
  const sensLabel = overlay.querySelector('[data-sens-label]') as HTMLElement;

  let open = false;

  function paint(): void {
    const s = getSettings();
    const size = clamp(Math.round(s.pixelSize), 1, 8);
    const mouse = clamp(Math.round(s.mouseSensitivity * 10) / 10, 0.3, 2);
    pixel.value = String(size);
    pixelLabel.textContent = `像素大小 ${size}`;
    outline.checked = s.outline;
    sens.value = String(mouse);
    sensLabel.textContent = `鼠标灵敏度 ${mouse.toFixed(1)}`;
  }

  function setOpen(next: boolean): void {
    if (open === next) return;
    open = next;
    overlay.hidden = !open;
    if (open) gear.hidden = true;
    bus.emit('ui:modal', { id: 'settings', open });
    if (open) paint();
  }

  pixel.addEventListener('input', () => {
    updateSettings({ pixelSize: Number(pixel.value) });
  });
  outline.addEventListener('change', () => {
    updateSettings({ outline: outline.checked });
  });
  sens.addEventListener('input', () => {
    updateSettings({ mouseSensitivity: Number(sens.value) });
  });

  gear.addEventListener('click', () => setOpen(true));
  overlay.querySelector('[data-close]')!.addEventListener('click', () => setOpen(false));

  bus.on('settings:changed', paint);

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
