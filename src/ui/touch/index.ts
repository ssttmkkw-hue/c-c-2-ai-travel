/**
 * 触屏最小操作层：摇杆、右侧滑视角、跳跃 / 跑 / 交谈、护照 / 衣柜 / 设置。
 * 只写 Input 的虚拟口子，交谈走 npc:interact。不 import Player / World / Engine。
 * 精细指针（鼠标）不挂这层，桌面操作保持原样。
 */
import { Input } from '@/core/Input';
import { bus } from '@/core/events';
import { modals } from '@/core/ui';
import './touch.css';

const STICK_RADIUS = 48;

export function mountTouch(root: HTMLElement, input: Input): void {
  if (!Input.isCoarsePointer()) return;

  const layer = document.createElement('div');
  layer.className = 'touch-layer';
  layer.innerHTML = `
    <div class="touch-look" data-look></div>
    <div class="touch-menu">
      <button type="button" class="touch-btn" data-key="KeyM">护照</button>
      <button type="button" class="touch-btn" data-key="KeyB">衣柜</button>
      <button type="button" class="touch-btn" data-key="KeyP">设置</button>
    </div>
    <div class="touch-pad" data-stick>
      <div class="touch-stick"></div>
      <div class="touch-knob" data-knob></div>
    </div>
    <div class="touch-actions">
      <button type="button" class="touch-btn" data-talk hidden>交谈</button>
      <button type="button" class="touch-btn" data-run>跑</button>
      <button type="button" class="touch-btn" data-jump>跳</button>
    </div>
  `;
  root.appendChild(layer);

  const look = layer.querySelector('[data-look]') as HTMLElement;
  const stick = layer.querySelector('[data-stick]') as HTMLElement;
  const knob = layer.querySelector('[data-knob]') as HTMLElement;
  const talk = layer.querySelector('[data-talk]') as HTMLButtonElement;
  const run = layer.querySelector('[data-run]') as HTMLButtonElement;
  const jump = layer.querySelector('[data-jump]') as HTMLButtonElement;
  let nearby: string | null = null;

  function syncTalk(): void {
    talk.hidden = !nearby || modals.any();
  }

  function hideWhileModal(): void {
    const open = modals.any();
    look.toggleAttribute('hidden', open);
    stick.toggleAttribute('hidden', open);
    run.parentElement?.toggleAttribute('hidden', open);
    syncTalk();
  }

  bus.on('npc:nearby', ({ npcId }) => {
    nearby = npcId;
    syncTalk();
  });
  bus.on('ui:modal', () => hideWhileModal());
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) return;
    knob.style.transform = '';
    input.setVirtualMove(0, 0);
    input.setVirtualRun(false);
  });

  bindStick(stick, knob, input);
  bindLook(look, input);

  jump.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    input.pressVirtual('Space');
  });
  run.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    input.setVirtualRun(true);
  });
  run.addEventListener('pointerup', () => input.setVirtualRun(false));
  run.addEventListener('pointercancel', () => input.setVirtualRun(false));

  talk.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (nearby) bus.emit('npc:interact', { npcId: nearby });
  });

  layer.querySelectorAll<HTMLButtonElement>('[data-key]').forEach((btn) => {
    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      const code = btn.dataset.key;
      if (!code) return;
      // 走现有快捷键路由（护照 M、衣柜 B、设置 P），不另开一套开关
      window.dispatchEvent(new KeyboardEvent('keydown', { code, bubbles: true, cancelable: true }));
    });
  });
}

function bindStick(stick: HTMLElement, knob: HTMLElement, input: Input): void {
  let pointer = -1;
  const onMove = (e: PointerEvent): void => {
    if (e.pointerId !== pointer) return;
    const rect = stick.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    let dx = e.clientX - cx;
    let dy = e.clientY - cy;
    const len = Math.hypot(dx, dy) || 1;
    const scale = Math.min(1, STICK_RADIUS / len);
    dx *= scale;
    dy *= scale;
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
    input.setVirtualMove(dx / STICK_RADIUS, -dy / STICK_RADIUS);
  };
  const end = (e: PointerEvent): void => {
    if (e.pointerId !== pointer) return;
    pointer = -1;
    knob.style.transform = '';
    input.setVirtualMove(0, 0);
    stick.releasePointerCapture?.(e.pointerId);
  };
  stick.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    pointer = e.pointerId;
    stick.setPointerCapture?.(e.pointerId);
    onMove(e);
  });
  stick.addEventListener('pointermove', onMove);
  stick.addEventListener('pointerup', end);
  stick.addEventListener('pointercancel', end);
}

function bindLook(look: HTMLElement, input: Input): void {
  let pointer = -1;
  let lastX = 0;
  let lastY = 0;
  look.addEventListener('pointerdown', (e) => {
    if (pointer !== -1) return;
    pointer = e.pointerId;
    lastX = e.clientX;
    lastY = e.clientY;
    look.setPointerCapture?.(e.pointerId);
  });
  look.addEventListener('pointermove', (e) => {
    if (e.pointerId !== pointer) return;
    input.addLook(e.clientX - lastX, e.clientY - lastY);
    lastX = e.clientX;
    lastY = e.clientY;
  });
  const end = (e: PointerEvent): void => {
    if (e.pointerId !== pointer) return;
    pointer = -1;
  };
  look.addEventListener('pointerup', end);
  look.addEventListener('pointercancel', end);
}
