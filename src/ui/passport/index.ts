/**
 * 护照选卡。只通过 bus 和游戏通信。
 * 没有弹窗时 Tab / M 打开；护照在最上层时 Esc / Tab / M 合上，方向键选择，Enter 出发。
 */
import { bus } from '@/core/events';
import { keys } from '@/core/ui';
import { MAP_CARDS } from '@/world/registry';
import type { MapCardDef } from '@/world/MapCard';
import './passport.css';

/** 护照只显示正式地图卡（devOnly 的道具馆等只能用数字键进入） */
const CARDS = MAP_CARDS.filter((c) => !c.devOnly);

export function mountPassport(root: HTMLElement): void {
  const overlay = document.createElement('div');
  overlay.className = 'passport';
  overlay.hidden = true;
  overlay.innerHTML = `
    <div class="passport-book" role="dialog" aria-modal="true" aria-label="护照">
      <header class="passport-head">
        <div>
          <h1 class="passport-title">护照</h1>
          <p class="passport-sub">选一张地图卡，盖章出发</p>
        </div>
        <button type="button" class="passport-close" data-close>合上</button>
      </header>
      <div class="passport-grid" data-grid></div>
      <p class="passport-foot">方向键选择 · Enter 出发 · Esc / Tab / M 合上</p>
    </div>
  `;
  root.appendChild(overlay);

  const grid = overlay.querySelector('[data-grid]') as HTMLElement;
  const buttons: HTMLButtonElement[] = [];
  let open = false;
  let currentId: string | null = null;
  let selected = 0;

  CARDS.forEach((card, index) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'passport-card';
    btn.dataset.id = card.id;
    paintCard(btn, card);
    btn.addEventListener('click', () => depart(index));
    btn.addEventListener('pointerenter', () => {
      selected = index;
      paintSelection();
    });
    grid.appendChild(btn);
    buttons.push(btn);
  });

  function cols(): number {
    // 按实际排版数列数：窄屏时样式表会变成单列，而 #ui 有整体缩放（ui/scale.ts），不能拿 window.innerWidth 判断
    const top = buttons[0]?.offsetTop;
    return Math.max(1, buttons.filter((b) => b.offsetTop === top).length);
  }

  function paintSelection(): void {
    buttons.forEach((btn, i) => btn.classList.toggle('is-selected', i === selected));
  }

  function setOpen(next: boolean): void {
    if (open === next) return;
    open = next;
    overlay.hidden = !open;
    bus.emit('ui:modal', { id: 'passport', open });
    if (open) {
      const idx = CARDS.findIndex((c) => c.id === currentId);
      selected = idx >= 0 ? idx : 0;
      paintSelection();
    }
  }

  function depart(index: number): void {
    const card = CARDS[index];
    if (!card) return;
    selected = index;
    bus.emit('map:request', { id: card.id });
    setOpen(false);
  }

  function move(dx: number, dy: number): void {
    const n = CARDS.length;
    if (!n) return;
    const c = cols();
    const col = selected % c;
    const row = Math.floor(selected / c);
    const rows = Math.ceil(n / c);
    let nextCol = col + dx;
    let nextRow = row + dy;
    if (nextCol < 0) nextCol = c - 1;
    if (nextCol >= c) nextCol = 0;
    if (nextRow < 0) nextRow = rows - 1;
    if (nextRow >= rows) nextRow = 0;
    let next = nextRow * c + nextCol;
    if (next >= n) next = n - 1;
    selected = next;
    paintSelection();
    buttons[selected]?.scrollIntoView({ block: 'nearest' });
  }

  overlay.querySelector('[data-close]')!.addEventListener('click', () => setOpen(false));

  keys.bind('game', ['Tab', 'KeyM'], () => setOpen(true));
  keys.bind('passport', ['Escape', 'Tab', 'KeyM'], () => setOpen(false));
  keys.bind('passport', 'ArrowLeft', () => move(-1, 0), { repeat: true });
  keys.bind('passport', 'ArrowRight', () => move(1, 0), { repeat: true });
  keys.bind('passport', 'ArrowUp', () => move(0, -1), { repeat: true });
  keys.bind('passport', 'ArrowDown', () => move(0, 1), { repeat: true });
  keys.bind('passport', 'Enter', () => depart(selected));

  bus.on('map:loaded', ({ card }) => {
    currentId = card.id;
    buttons.forEach((btn) => {
      const stamp = btn.querySelector('.passport-stamp');
      const here = btn.dataset.id === currentId;
      if (here && !stamp) {
        const el = document.createElement('span');
        el.className = 'passport-stamp';
        el.textContent = '当前位置';
        const accent = CARDS.find((c) => c.id === btn.dataset.id)?.palette.accent[0] ?? '#c03030';
        el.style.color = accent;
        el.style.borderColor = accent;
        btn.appendChild(el);
      } else if (!here && stamp) {
        stamp.remove();
      }
    });
  });

  setOpen(true);
}

function paintCard(btn: HTMLButtonElement, card: MapCardDef): void {
  const p = card.palette;
  const sky = p.sky;
  const a = p.primary[0] ?? sky;
  const b = p.primary[1] ?? a;
  const accent = p.accent[0] ?? p.outline;
  const stripe = p.accent[1] ?? accent;
  btn.style.background = `
    repeating-linear-gradient(90deg, ${stripe} 0 4px, transparent 4px 16px),
    linear-gradient(160deg, ${sky} 0%, ${a} 42%, ${b} 100%)
  `;
  btn.style.backgroundBlendMode = 'soft-light, normal';
  btn.style.borderColor = p.outline;
  btn.innerHTML = `
    <span class="passport-card-country">${esc(card.country)}</span>
    <span class="passport-card-name">${esc(card.name)}</span>
    <span class="passport-card-local">${esc(card.nameLocal)}</span>
    <span class="passport-card-tag">${esc(card.tagline)}</span>
  `;
}

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]!));
}
