/**
 * 开发快捷键。正式地点 / 操作提示在 HUD。
 *
 * 快捷键：1~9 切换地图卡，[ ] 调像素大小，O 开关描边，V 切视角（玩家侧）。
 */
import { bus } from '@/core/events';
import { getSettings, updateSettings } from '@/core/settings';
import { setOutlineVisible } from '@/render/toon';
import { MAP_CARDS } from '@/world/registry';

export function mountDebugHud(_root: HTMLElement): void {
  window.addEventListener('keydown', (e) => {
    const n = Number(e.key);
    if (n >= 1 && n <= MAP_CARDS.length) bus.emit('map:request', { id: MAP_CARDS[n - 1].id });
    const s = getSettings();
    if (e.key === '[') updateSettings({ pixelSize: Math.max(1, s.pixelSize - 1) });
    if (e.key === ']') updateSettings({ pixelSize: Math.min(10, s.pixelSize + 1) });
    if (e.code === 'KeyO') updateSettings({ outline: !s.outline });
  });
  bus.on('settings:changed', (s) => setOutlineVisible(s.outline));
  setOutlineVisible(getSettings().outline);
}
