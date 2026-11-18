/**
 * 衣柜。没有弹窗时 B 打开；衣柜在最上层时 B / Esc 关闭。
 * 按服装 origin 分组（巴黎地图还没有，分组照样显示）。点击即换装。
 */
import { bus } from '@/core/events';
import { keys } from '@/core/ui';
import { OUTFITS } from '@/avatar/outfits';
import type { OutfitDef } from '@/avatar/types';
import './wardrobe.css';

const GROUP_LABEL: Record<string, string> = {
  default: '随身',
  tokyo: '东京',
  egypt: '埃及',
  paris: '巴黎',
};

const GROUP_ORDER = ['default', 'tokyo', 'egypt', 'paris'];

export function mountWardrobe(root: HTMLElement): void {
  const overlay = document.createElement('div');
  overlay.className = 'wardrobe';
  overlay.hidden = true;
  overlay.innerHTML = `
    <div class="wardrobe-book" role="dialog" aria-modal="true" aria-label="衣柜">
      <header class="wardrobe-head">
        <div>
          <h1 class="wardrobe-title">衣柜</h1>
          <p class="wardrobe-sub">各地的衣服都先放出来，点击就能换</p>
        </div>
        <button type="button" class="wardrobe-close" data-close>关闭</button>
      </header>
      <div data-groups></div>
      <p class="wardrobe-foot">B / Esc 关闭 · 点击卡片换装</p>
    </div>
  `;
  root.appendChild(overlay);

  const groups = overlay.querySelector('[data-groups]') as HTMLElement;
  const cards = new Map<string, HTMLButtonElement>();
  let open = false;
  let equipped = 'default';

  for (const origin of orderedOrigins()) {
    const section = document.createElement('section');
    section.className = 'wardrobe-group';
    const title = document.createElement('h2');
    title.className = 'wardrobe-group-name';
    title.textContent = GROUP_LABEL[origin] ?? origin;
    const grid = document.createElement('div');
    grid.className = 'wardrobe-grid';
    for (const outfit of OUTFITS.filter((o) => o.origin === origin)) {
      const btn = card(outfit);
      btn.addEventListener('click', () => equip(outfit.id));
      grid.appendChild(btn);
      cards.set(outfit.id, btn);
    }
    section.append(title, grid);
    groups.appendChild(section);
  }

  function equip(id: string): void {
    bus.emit('outfit:equip', { outfitId: id });
  }

  function paint(): void {
    cards.forEach((btn, id) => {
      const on = id === equipped;
      btn.classList.toggle('is-equipped', on);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      const stamp = btn.querySelector('.wardrobe-stamp');
      if (on && !stamp) {
        const el = document.createElement('span');
        el.className = 'wardrobe-stamp';
        el.textContent = '穿着中';
        btn.appendChild(el);
      } else if (!on && stamp) {
        stamp.remove();
      }
    });
  }

  function setOpen(next: boolean): void {
    if (open === next) return;
    open = next;
    overlay.hidden = !open;
    bus.emit('ui:modal', { id: 'wardrobe', open });
    if (open) paint();
  }

  overlay.querySelector('[data-close]')!.addEventListener('click', () => setOpen(false));
  keys.bind('game', 'KeyB', () => setOpen(true));
  keys.bind('wardrobe', ['KeyB', 'Escape'], () => setOpen(false));
  bus.on('outfit:equip', ({ outfitId }) => {
    equipped = outfitId;
    paint();
  });

  paint();
}

function orderedOrigins(): string[] {
  const present = new Set(OUTFITS.map((o) => o.origin));
  const known = GROUP_ORDER.filter((id) => present.has(id));
  const rest = [...present].filter((id) => !GROUP_ORDER.includes(id));
  return [...known, ...rest];
}

function card(outfit: OutfitDef): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'wardrobe-card';
  btn.dataset.id = outfit.id;
  const swatches = [outfit.colors.top, outfit.colors.bottom, outfit.colors.hat].filter((c): c is string => !!c);
  btn.innerHTML = `
    <span class="wardrobe-swatches">
      ${swatches.map((c) => `<span class="wardrobe-swatch" style="background:${esc(c)}"></span>`).join('')}
    </span>
    <span class="wardrobe-name">${esc(outfit.name)}</span>
  `;
  return btn;
}

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]!));
}
