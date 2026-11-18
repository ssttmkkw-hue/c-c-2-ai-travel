/**
 * 正式 HUD：地点、操作提示、交谈提示。不挡鼠标。
 */
import { bus } from '@/core/events';
import './hud.css';

const HINT_MS = 4500;

export function mountHud(root: HTMLElement): void {
  const wrap = document.createElement('div');
  wrap.className = 'hud';
  wrap.innerHTML = `
    <p class="hud-place" data-place hidden></p>
    <p class="hud-hints" data-hints>点击画面锁定鼠标 · WASD 移动 · Shift 跑 · Space 跳 · V 切视角 · P 设置 · H 再显示本提示</p>
    <p class="hud-talk" data-talk hidden>按 E 交谈</p>
  `;
  root.appendChild(wrap);

  const place = wrap.querySelector('[data-place]') as HTMLElement;
  const hints = wrap.querySelector('[data-hints]') as HTMLElement;
  const talk = wrap.querySelector('[data-talk]') as HTMLElement;
  let hintTimer = 0;
  const modals = new Set<string>();
  let nearby: string | null = null;

  function syncTalk(): void {
    talk.hidden = !nearby || modals.size > 0;
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

  bus.on('ui:modal', ({ id, open }) => {
    if (open) modals.add(id);
    else modals.delete(id);
    syncTalk();
  });
  // 弹层若先挂载，open 事件已经发出。挂载后（含同一轮后续挂载）再对一下 DOM。
  const syncModals = (): void => {
    const passport = root.querySelector('.passport');
    if (passport instanceof HTMLElement) {
      if (passport.hidden) modals.delete('passport');
      else modals.add('passport');
    }
    const settings = root.querySelector('.settings');
    if (settings instanceof HTMLElement) {
      if (settings.hidden) modals.delete('settings');
      else modals.add('settings');
    }
    syncTalk();
  };
  syncModals();
  queueMicrotask(syncModals);

  showHints();

  window.addEventListener(
    'keydown',
    (e) => {
      if (e.code !== 'KeyH' || e.repeat || isTyping(e)) return;
      if (modals.size > 0) return;
      e.preventDefault();
      e.stopPropagation();
      showHints();
    },
    true,
  );
}

function isTyping(e: KeyboardEvent): boolean {
  const t = e.target as HTMLElement | null;
  return !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
}
