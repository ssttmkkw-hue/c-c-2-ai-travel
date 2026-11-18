/**
 * 正式 HUD：地点、操作提示、交谈提示。不挡鼠标。
 */
import { bus } from '@/core/events';
import { keys, modals } from '@/core/ui';
import './hud.css';

const HINT_MS = 4500;

export function mountHud(root: HTMLElement): void {
  const wrap = document.createElement('div');
  wrap.className = 'hud';
  wrap.innerHTML = `
    <p class="hud-place" data-place hidden></p>
    <p class="hud-hints" data-hints></p>
    <p class="hud-talk" data-talk hidden>按 E 交谈</p>
  `;
  root.appendChild(wrap);

  const place = wrap.querySelector('[data-place]') as HTMLElement;
  const hints = wrap.querySelector('[data-hints]') as HTMLElement;
  const talk = wrap.querySelector('[data-talk]') as HTMLElement;
  const coarse = isCoarsePointer();
  hints.textContent = coarse
    ? '左侧摇杆移动 · 右侧滑动转视角 · 右下角跳跃和交谈 · 右上角打开护照、衣柜、设置'
    : '点击画面锁定鼠标 · WASD 移动 · Shift 跑 · Space 跳 · V 切视角 · P 设置 · H 再显示本提示';
  if (coarse) {
    hints.classList.add('is-coarse');
    talk.textContent = '点「交谈」';
  }
  let hintTimer = 0;
  let nearby: string | null = null;

  function syncTalk(): void {
    talk.hidden = !nearby || modals.any();
  }

  function showHints(): void {
    hints.classList.remove('is-dim');
    window.clearTimeout(hintTimer);
    hintTimer = window.setTimeout(() => hints.classList.add('is-dim'), HINT_MS);
  }

  bus.on('map:loaded', ({ card }) => {
    place.hidden = false;
    place.textContent = `📍 ${card.name} · ${card.country}`;
    place.style.animation = 'none';
    void place.offsetWidth;
    place.style.animation = '';
  });

  bus.on('npc:nearby', ({ npcId }) => {
    nearby = npcId;
    syncTalk();
  });

  bus.on('ui:modal', () => syncTalk());

  showHints();
  syncTalk();

  keys.bind('game', 'KeyH', () => showHints());
}

function isCoarsePointer(): boolean {
  try {
    return window.matchMedia?.('(pointer: coarse)').matches ?? false;
  } catch {
    return false;
  }
}
