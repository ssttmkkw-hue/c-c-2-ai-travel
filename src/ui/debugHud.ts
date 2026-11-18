/**
 * 开发快捷键。正式地点 / 操作提示在 HUD。
 *
 * 快捷键：1~9 切换地图卡，[ ] 调像素大小，O 开关描边，V 切视角（玩家侧）。
 * 这些快捷键只在 dev 模式（import.meta.env.DEV）注册；正式构建里不能用数字键进入 devOnly 的道具馆等调试地图。
 * 描边设置同步（setOutlineVisible）在正式构建里也要保留。
 */
import { bus } from '@/core/events';
import { getSettings, updateSettings } from '@/core/settings';
import { keys } from '@/core/ui';
import { setOutlineVisible } from '@/render/toon';
import { MAP_CARDS } from '@/world/registry';

const DIGITS = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8', 'Digit9'];

export function mountDebugHud(_root: HTMLElement): void {
  bus.on('settings:changed', (s) => setOutlineVisible(s.outline));
  setOutlineVisible(getSettings().outline);
  if (!import.meta.env.DEV) return;
  keys.bind('game', [...DIGITS, 'BracketLeft', 'BracketRight', 'KeyO'], (e) => {
    const n = DIGITS.indexOf(e.code);
    if (n >= 0 && n < MAP_CARDS.length) bus.emit('map:request', { id: MAP_CARDS[n].id });
    const s = getSettings();
    if (e.code === 'BracketLeft') updateSettings({ pixelSize: Math.max(1, s.pixelSize - 1) });
    if (e.code === 'BracketRight') updateSettings({ pixelSize: Math.min(10, s.pixelSize + 1) });
    if (e.code === 'KeyO') updateSettings({ outline: !s.outline });
  });
}
