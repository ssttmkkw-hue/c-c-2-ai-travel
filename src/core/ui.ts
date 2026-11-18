/**
 * UI 基础设施：弹窗栈 + 按键路由。🔒 Claude 保留区
 *
 * 规则：UI 模块**不要**自己 window.addEventListener('keydown')，一律用 keys.bind 注册快捷键。
 *
 *   // 没有弹窗时按 Tab 打开护照
 *   keys.bind('game', ['Tab', 'KeyM'], () => open());
 *   // 护照在最上层时，Esc / Tab / M 关闭
 *   keys.bind('passport', ['Escape', 'Tab', 'KeyM'], () => close());
 *
 * 路由规则：
 * - 有弹窗打开时，只有「最上层弹窗」作用域的绑定生效；没有弹窗时只有 'game' 作用域生效。
 *   所以护照、设置、对话框之间不需要互相知道对方是否打开，也不依赖挂载顺序。
 * - 命中绑定的按键会被 preventDefault + stopImmediatePropagation，不会再传给其他监听者。
 * - 没命中的按键不处理（例如设置面板里聚焦的滑块仍能用方向键）。
 * - 焦点在文本输入框里时，除 Escape 外不路由（AI 导游的提问输入框能正常打字）。
 * - 弹窗打开/关闭仍然用 bus.emit('ui:modal', { id, open })，本模块监听它维护弹窗栈。
 */
import { bus } from './events';

/** 'game' = 没有弹窗时；其他字符串 = 该 id 的弹窗位于最上层时 */
export type KeyScope = 'game' | (string & {});

export interface BindOptions {
  /** 长按时是否重复触发，默认 false */
  repeat?: boolean;
}

type Binding = { fn: (e: KeyboardEvent) => void; repeat: boolean };

// ---------- 弹窗栈 ----------
const stack: string[] = [];

bus.on('ui:modal', ({ id, open }) => {
  const i = stack.indexOf(id);
  if (i >= 0) stack.splice(i, 1);
  if (open) {
    stack.push(id);
    document.exitPointerLock?.();
  }
});

export const modals = {
  /** 最上层弹窗 id，没有则为 null */
  top(): string | null {
    return stack.length ? stack[stack.length - 1] : null;
  },
  isOpen(id: string): boolean {
    return stack.includes(id);
  },
  /** 是否有任何弹窗打开 */
  any(): boolean {
    return stack.length > 0;
  },
  list(): readonly string[] {
    return stack;
  },
};

// ---------- 按键路由 ----------
const bindings = new Map<string, Map<string, Set<Binding>>>();

export const keys = {
  /**
   * 注册快捷键。codes 用 KeyboardEvent.code（'KeyP'、'Tab'、'Escape'、'Enter'、'ArrowLeft'、'Digit1'、'BracketLeft'...）
   * 返回取消函数。
   */
  bind(scope: KeyScope, codes: string | string[], fn: (e: KeyboardEvent) => void, opts: BindOptions = {}): () => void {
    const list = Array.isArray(codes) ? codes : [codes];
    const b: Binding = { fn, repeat: opts.repeat ?? false };
    let byCode = bindings.get(scope);
    if (!byCode) bindings.set(scope, (byCode = new Map()));
    for (const code of list) {
      if (!byCode.has(code)) byCode.set(code, new Set());
      byCode.get(code)!.add(b);
    }
    return () => list.forEach((code) => byCode!.get(code)?.delete(b));
  },
};

window.addEventListener(
  'keydown',
  (e) => {
    if (e.code !== 'Escape' && isTextInput(e.target)) return;
    const scope = modals.top() ?? 'game';
    const hs = bindings.get(scope)?.get(e.code);
    if (!hs || hs.size === 0) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    for (const b of [...hs]) if (!e.repeat || b.repeat) b.fn(e);
  },
  true,
);

const TEXT_TYPES = new Set(['text', 'search', 'email', 'url', 'tel', 'password', 'number']);

function isTextInput(t: EventTarget | null): boolean {
  if (!(t instanceof HTMLElement)) return false;
  if (t.isContentEditable || t.tagName === 'TEXTAREA') return true;
  return t instanceof HTMLInputElement && TEXT_TYPES.has(t.type);
}
