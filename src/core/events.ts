/**
 * 全局事件总线。模块之间（尤其是 UI ↔ 游戏逻辑）只通过这里通信，不要互相直接 import 内部状态。
 * 新增事件：在 GameEvents 里加一行类型即可。
 */
import type { MapCardDef } from '@/world/MapCard';
import type { Settings } from './settings';

export interface GameEvents {
  /** 请求切换地图卡（UI 发出，MapManager 处理） */
  'map:request': { id: string };
  /**
   * 地图卡开始加载。过场动画可调用 waitFor(promise)：World 会等所有 promise 完成（遮罩盖满屏幕）后
   * 才卸载旧地图、构建新地图，避免画面闪烁。最长等待 3 秒。
   */
  'map:loading': { from: MapCardDef | null; to: MapCardDef; waitFor(p: Promise<unknown>): void };
  /** 地图卡加载完成 */
  'map:loaded': { card: MapCardDef };
  /** 设置变更 */
  'settings:changed': Settings;
  /** 视角切换 */
  'camera:mode': { mode: 'third' | 'first' };
  /** 玩家附近可交互的 NPC 变化（null = 没有），UI 用来显示“按 E 交谈”提示 */
  'npc:nearby': { npcId: string | null };
  /** 玩家与 NPC 交互（按 E） */
  'npc:interact': { npcId: string };
  /** 换装（衣柜 UI 发出，Player 处理） */
  'outfit:equip': { outfitId: string };
  /**
   * UI 弹窗开关（护照、设置、对话框、衣柜...）。任一弹窗打开时玩家不能移动/转视角，并自动释放鼠标锁定。
   * 每个弹窗用固定 id，打开发 open:true，关闭发 open:false。
   */
  'ui:modal': { id: string; open: boolean };
}

type Handler<T> = (payload: T) => void;

class EventBus {
  private handlers = new Map<keyof GameEvents, Set<Handler<any>>>();

  on<K extends keyof GameEvents>(type: K, fn: Handler<GameEvents[K]>): () => void {
    if (!this.handlers.has(type)) this.handlers.set(type, new Set());
    this.handlers.get(type)!.add(fn);
    return () => this.handlers.get(type)?.delete(fn);
  }

  emit<K extends keyof GameEvents>(type: K, payload: GameEvents[K]): void {
    this.handlers.get(type)?.forEach((fn) => fn(payload));
  }
}

export const bus = new EventBus();
