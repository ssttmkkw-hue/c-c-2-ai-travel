/**
 * 地图切换过场：像素格子盖住屏幕后再让 World 换场景，加载完成后消散。
 * 开局 from === null 时不播（护照正开着）。连按切图时作废上一轮计时，已盖满则立刻放行 waitFor。
 */
import { bus } from '@/core/events';
import type { MapCardDef } from '@/world/MapCard';
import './transition.css';

const CELL = 24;
const MIN_HOLD_MS = 1200;
/** 短于 World 的 3 秒上限，避免 waitFor 一直挂到超时 */
const COVER_SAFETY_MS = 2500;
const COVER_MS = 480;
const CLEAR_MS = 420;

export function mountTransition(root: HTMLElement): void {
  const overlay = document.createElement('div');
  overlay.className = 'travel-transition';
  overlay.hidden = true;
  const canvas = document.createElement('canvas');
  const caption = document.createElement('p');
  caption.className = 'travel-caption';
  overlay.append(canvas, caption);
  root.appendChild(overlay);

  const ctx = canvas.getContext('2d')!;
  let cols = 0;
  let rows = 0;
  /** 1 = 已填 */
  let cells: Uint8Array = new Uint8Array(0);
  let order: number[] = [];
  let sky = '#111111';
  let accent = '#ff4f8b';

  let gen = 0;
  let covered = false;
  let modalOpen = false;
  let shownAt = 0;
  let resolveWait: (() => void) | null = null;
  let raf = 0;
  let holdTimer = 0;
  let safetyTimer = 0;
  let watchdog = 0;

  function resize(): void {
    const w = overlay.clientWidth || window.innerWidth;
    const h = overlay.clientHeight || window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.floor(w * dpr));
    canvas.height = Math.max(1, Math.floor(h * dpr));
    cols = Math.max(1, Math.ceil(w / CELL));
    rows = Math.max(1, Math.ceil(h / CELL));
    const n = cols * rows;
    if (cells.length !== n) {
      const next = new Uint8Array(n);
      const copy = Math.min(cells.length, n);
      next.set(cells.subarray(0, copy));
      cells = next;
    }
    paint();
  }

  function paint(): void {
    const cw = canvas.width / cols;
    const ch = canvas.height / rows;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (let i = 0; i < cells.length; i++) {
      if (!cells[i]) continue;
      const x = i % cols;
      const y = (i / cols) | 0;
      ctx.fillStyle = i % 11 === 0 ? accent : sky;
      ctx.fillRect(Math.floor(x * cw), Math.floor(y * ch), Math.ceil(cw) + 1, Math.ceil(ch) + 1);
    }
  }

  function shuffle(n: number): number[] {
    const a = Array.from({ length: n }, (_, i) => i);
    for (let i = n - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) | 0;
      const t = a[i]!;
      a[i] = a[j]!;
      a[j] = t;
    }
    return a;
  }

  function setModal(open: boolean): void {
    if (modalOpen === open) return;
    modalOpen = open;
    bus.emit('ui:modal', { id: 'transition', open });
  }

  function releaseWait(): void {
    const done = resolveWait;
    resolveWait = null;
    done?.();
  }

  function stopMotion(): void {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    if (holdTimer) window.clearTimeout(holdTimer);
    holdTimer = 0;
    if (safetyTimer) window.clearTimeout(safetyTimer);
    safetyTimer = 0;
  }

  function applyCard(card: MapCardDef): void {
    sky = card.palette.sky;
    accent = card.palette.accent[0] ?? card.palette.outline;
    caption.textContent = `✈ 前往 ${card.name} · ${card.country}`;
  }

  function show(): void {
    if (overlay.hidden) {
      overlay.hidden = false;
      shownAt = performance.now();
    }
    resize();
    setModal(true);
  }

  function hide(): void {
    overlay.hidden = true;
    covered = false;
    cells.fill(0);
    if (watchdog) window.clearTimeout(watchdog);
    watchdog = 0;
    setModal(false);
  }

  /** 加载失败或事件丢失时不要把玩家冻在过场里 */
  function armWatchdog(token: number): void {
    if (watchdog) window.clearTimeout(watchdog);
    watchdog = window.setTimeout(() => {
      if (token !== gen || overlay.hidden) return;
      stopMotion();
      hide();
    }, 8000);
  }

  function animateFill(token: number, duration: number, onDone: () => void): void {
    const start = performance.now();
    const total = order.length;
    const step = (now: number) => {
      if (token !== gen) return;
      const t = Math.min(1, (now - start) / duration);
      const count = Math.floor(t * total);
      for (let k = 0; k < count; k++) cells[order[k]!] = 1;
      paint();
      if (t < 1) raf = requestAnimationFrame(step);
      else onDone();
    };
    raf = requestAnimationFrame(step);
  }

  function animateClear(token: number, onDone: () => void): void {
    const start = performance.now();
    const total = order.length;
    const step = (now: number) => {
      if (token !== gen) return;
      const t = Math.min(1, (now - start) / CLEAR_MS);
      const count = Math.floor(t * total);
      for (let k = 0; k < count; k++) cells[order[k]!] = 0;
      paint();
      if (t < 1) raf = requestAnimationFrame(step);
      else onDone();
    };
    raf = requestAnimationFrame(step);
  }

  function beginCover(token: number): void {
    resize();
    if (covered && cells.length && cells.every((v) => v === 1)) {
      paint();
      releaseWait();
      return;
    }
    cells.fill(0);
    order = shuffle(cells.length);
    covered = false;
    animateFill(token, COVER_MS, () => {
      if (token !== gen) return;
      covered = true;
      releaseWait();
    });
    safetyTimer = window.setTimeout(() => {
      if (token !== gen) return;
      cells.fill(1);
      covered = true;
      paint();
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      releaseWait();
    }, COVER_SAFETY_MS);
  }

  bus.on('map:loading', (e) => {
    // 开局护照已打开，第一次加载不盖过场
    if (e.from === null) return;

    gen += 1;
    const token = gen;
    stopMotion();
    // 上一轮若已被 World 超时放行，这里 settle 掉残留的 promise
    releaseWait();
    applyCard(e.to);
    show();
    armWatchdog(token);
    const gate = new Promise<void>((resolve) => {
      resolveWait = resolve;
    });
    e.waitFor(gate);
    beginCover(token);
  });

  bus.on('map:loaded', () => {
    if (overlay.hidden) return;
    const token = gen;
    stopMotion();
    cells.fill(1);
    covered = true;
    paint();
    const elapsed = performance.now() - shownAt;
    const wait = Math.max(0, MIN_HOLD_MS - elapsed);
    holdTimer = window.setTimeout(() => {
      if (token !== gen) return;
      order = shuffle(cells.length || 1);
      animateClear(token, () => {
        if (token !== gen) return;
        hide();
      });
    }, wait);
  });

  window.addEventListener('resize', () => {
    if (!overlay.hidden) resize();
  });
}
