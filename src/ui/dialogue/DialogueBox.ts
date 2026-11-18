/**
 * 像素风对话框。NPC 台词和之后的 AI 导游都走这五个方法。
 * 推进键走 dialogue 作用域；点击只落在对话框自身上。
 */
import { bus } from '@/core/events';
import { keys } from '@/core/ui';
import { MAP_CARDS } from '@/world/registry';
import type { MapCardDef } from '@/world/MapCard';
import type { NpcDef } from '@/npc/types';
import './dialogue.css';

const TYPE_MS = 42;
const CONTINUE_HINT = 'E / 空格 / 点击继续 · Esc 结束';

interface SayJob {
  text: string;
  resolve: () => void;
}

export class DialogueBox {
  readonly root: HTMLElement;
  private readonly nameEl: HTMLElement;
  private readonly textEl: HTMLElement;
  private readonly hintEl: HTMLElement;
  private readonly optionsEl: HTMLElement;

  private opened = false;
  private full = '';
  private shown = 0;
  private typing = false;
  private typeTimer = 0;
  private sayResolve: (() => void) | null = null;
  private readonly sayQueue: SayJob[] = [];
  private advanceWait: (() => void) | null = null;
  private chooseResolve: ((index: number) => void) | null = null;
  private choice = 0;
  private session = 0;

  constructor(parent: HTMLElement) {
    this.root = document.createElement('div');
    this.root.className = 'dialogue';
    this.root.hidden = true;
    this.root.innerHTML = `
      <div class="dialogue-box" role="dialog" aria-modal="true" aria-label="对话">
        <p class="dialogue-name" data-name></p>
        <p class="dialogue-text" data-text></p>
        <div class="dialogue-options" data-options></div>
        <p class="dialogue-hint" data-hint>E / 空格 / 点击继续 · Esc 结束</p>
      </div>
    `;
    parent.appendChild(this.root);
    this.nameEl = this.root.querySelector('[data-name]') as HTMLElement;
    this.textEl = this.root.querySelector('[data-text]') as HTMLElement;
    this.hintEl = this.root.querySelector('[data-hint]') as HTMLElement;
    this.optionsEl = this.root.querySelector('[data-options]') as HTMLElement;

    keys.bind('dialogue', ['KeyE', 'Space', 'Enter'], (e) => {
      if (!this.opened || e.repeat) return;
      this.advance();
    });
    keys.bind('dialogue', ['ArrowLeft', 'ArrowUp'], (e) => {
      if (!this.opened || !this.chooseResolve || e.repeat) return;
      this.moveChoice(-1);
    });
    keys.bind('dialogue', ['ArrowRight', 'ArrowDown'], (e) => {
      if (!this.opened || !this.chooseResolve || e.repeat) return;
      this.moveChoice(1);
    });
    keys.bind('dialogue', 'Escape', () => {
      if (this.opened) this.close();
    });
    this.root.addEventListener('click', (e) => this.onClick(e));
  }

  open(speaker: string): void {
    this.clearChoices();
    this.full = '';
    this.shown = 0;
    this.typing = false;
    window.clearTimeout(this.typeTimer);
    this.textEl.textContent = '';
    this.nameEl.textContent = speaker;
    this.hintEl.textContent = CONTINUE_HINT;
    this.setOpen(true);
  }

  /** 打字机效果；Promise 在整句显示完（含中途按键跳过）时 resolve */
  say(text: string): Promise<void> {
    if (!this.opened) this.open(this.nameEl.textContent ?? '');
    this.clearChoices();
    return new Promise((resolve) => {
      this.sayQueue.push({ text, resolve });
      this.pump();
    });
  }

  /** 流式追加。正在打字时延长当前句子，否则立刻显示 */
  append(chunk: string): void {
    if (!chunk) return;
    if (!this.opened) this.open(this.nameEl.textContent ?? '');
    this.full += chunk;
    if (!this.typing) {
      this.shown = this.full.length;
      this.textEl.textContent = this.full;
    }
  }

  choose(options: string[]): Promise<number> {
    if (!this.opened) this.open(this.nameEl.textContent ?? '');
    this.finishTyping();
    this.clearChoices();
    if (!options.length) return Promise.resolve(0);
    this.hintEl.textContent = '方向键选择 · E / 空格 / 点击确定';
    return new Promise((resolve) => {
      this.chooseResolve = resolve;
      this.choice = 0;
      options.forEach((label, index) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'dialogue-option';
        btn.dataset.choice = String(index);
        btn.textContent = label;
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.pick(index);
        });
        btn.addEventListener('pointerenter', () => {
          this.choice = index;
          this.paintChoice();
        });
        this.optionsEl.appendChild(btn);
      });
      this.paintChoice();
    });
  }

  close(): void {
    this.session += 1;
    this.sayQueue.splice(0).forEach((job) => job.resolve());
    this.finishTyping();
    if (this.advanceWait) {
      const wait = this.advanceWait;
      this.advanceWait = null;
      wait();
    }
    if (this.chooseResolve) {
      const pick = this.chooseResolve;
      this.chooseResolve = null;
      pick(this.choice);
    }
    this.clearChoices();
    this.full = '';
    this.shown = 0;
    this.textEl.textContent = '';
    this.setOpen(false);
  }

  get isOpen(): boolean {
    return this.opened;
  }

  /** 当前这轮台词的代号，关闭后作废 */
  nextSession(): number {
    this.session += 1;
    return this.session;
  }

  isSession(id: number): boolean {
    return id === this.session;
  }

  private setOpen(next: boolean): void {
    if (this.opened === next) return;
    this.opened = next;
    this.root.hidden = !next;
    bus.emit('ui:modal', { id: 'dialogue', open: next });
  }

  private pump(): void {
    if (this.typing || this.sayQueue.length === 0) return;
    const job = this.sayQueue.shift()!;
    this.full = job.text;
    this.shown = 0;
    this.typing = true;
    this.sayResolve = job.resolve;
    this.textEl.textContent = '';
    this.step();
  }

  private step(): void {
    if (!this.typing) return;
    if (this.shown >= this.full.length) {
      this.typing = false;
      const done = this.sayResolve;
      this.sayResolve = null;
      done?.();
      this.pump();
      return;
    }
    this.shown += 1;
    this.textEl.textContent = this.full.slice(0, this.shown);
    this.typeTimer = window.setTimeout(() => this.step(), TYPE_MS);
  }

  /** 打字中：补全当前句。返回是否吃掉了这次输入 */
  private finishTyping(): boolean {
    if (!this.typing) return false;
    window.clearTimeout(this.typeTimer);
    this.shown = this.full.length;
    this.textEl.textContent = this.full;
    this.typing = false;
    const done = this.sayResolve;
    this.sayResolve = null;
    done?.();
    this.pump();
    return true;
  }

  private paintChoice(): void {
    const buttons = this.optionsEl.querySelectorAll<HTMLButtonElement>('[data-choice]');
    buttons.forEach((btn, i) => btn.classList.toggle('is-selected', i === this.choice));
  }

  private moveChoice(delta: number): void {
    const n = this.optionsEl.children.length;
    if (!n || !this.chooseResolve) return;
    this.choice = (this.choice + delta + n) % n;
    this.paintChoice();
  }

  private pick(index: number): void {
    if (!this.chooseResolve) return;
    const resolve = this.chooseResolve;
    this.chooseResolve = null;
    this.choice = index;
    this.clearChoices();
    this.hintEl.textContent = CONTINUE_HINT;
    resolve(index);
  }

  private clearChoices(): void {
    this.optionsEl.replaceChildren();
  }

  private advance(): void {
    if (this.chooseResolve) {
      this.pick(this.choice);
      return;
    }
    if (this.finishTyping()) return;
    if (this.advanceWait) {
      const wait = this.advanceWait;
      this.advanceWait = null;
      wait();
    }
  }

  /** 台词播完后等下一次推进 */
  waitAdvance(): Promise<void> {
    if (this.advanceWait) this.advanceWait();
    return new Promise((resolve) => {
      this.advanceWait = resolve;
    });
  }

  private onClick(e: MouseEvent): void {
    if (!this.opened) return;
    const target = e.target as HTMLElement | null;
    if (target?.closest('[data-choice]')) return;
    this.advance();
  }
}

/** 刚合上后，同一 NPC 在这段时间内按 E 不会立刻再打开 */
const REOPEN_MS = 300;

/** 挂上对话框，并接 npc:interact 播放当前地图卡里的固定台词 */
export function mountDialogue(root: HTMLElement): DialogueBox {
  const box = new DialogueBox(root);
  let card: MapCardDef | null = null;
  let playing = false;
  let lastNpcId: string | null = null;
  let reopenAt = 0;

  bus.on('map:loaded', ({ card: next }) => {
    card = next;
  });

  bus.on('ui:modal', ({ id, open }) => {
    if (id === 'dialogue' && !open) reopenAt = performance.now() + REOPEN_MS;
  });

  bus.on('npc:interact', ({ npcId }) => {
    if (playing || box.isOpen) return;
    if (npcId === lastNpcId && performance.now() < reopenAt) return;
    const npc = findNpc(card, npcId);
    if (!npc || npc.lines.length === 0) return;
    lastNpcId = npcId;
    playing = true;
    void playLines(box, npc).finally(() => {
      playing = false;
    });
  });

  return box;
}

async function playLines(box: DialogueBox, npc: NpcDef): Promise<void> {
  const session = box.nextSession();
  box.open(npc.name);
  for (let i = 0; i < npc.lines.length; i += 1) {
    if (!box.isSession(session)) return;
    await box.say(npc.lines[i] ?? '');
    if (!box.isSession(session)) return;
    await box.waitAdvance();
  }
  if (box.isSession(session)) box.close();
}

function findNpc(card: MapCardDef | null, npcId: string): NpcDef | undefined {
  const fromCard = card?.npcs?.find((n) => n.id === npcId);
  if (fromCard) return fromCard;
  for (const map of MAP_CARDS) {
    const npc = map.npcs?.find((n) => n.id === npcId);
    if (npc) return npc;
  }
  return undefined;
}
