/**
 * 调试 HUD（临时）。正式 UI 由 Cursor 实现（T05 护照选卡 / T06 设置面板 / T10 对话框），
 * 完成后可删除本文件，但请保留数字键切图等快捷键（开发用）。
 *
 * 快捷键：1~9 切换地图卡，[ ] 调像素大小，O 开关描边，V 切视角
 */
import { bus } from '@/core/events';
import { getSettings, updateSettings } from '@/core/settings';
import { setOutlineVisible } from '@/render/toon';
import { MAP_CARDS } from '@/world/registry';

export function mountDebugHud(root: HTMLElement): void {
  const el = document.createElement('div');
  el.style.cssText =
    'position:absolute;left:12px;top:12px;padding:8px 12px;background:var(--ui-bg);font-size:12px;line-height:1.6;border-radius:4px;pointer-events:none;white-space:pre';
  root.appendChild(el);

  let mapName = '';
  let cam = 'third';
  let npc: string | null = null;
  const render = () => {
    const s = getSettings();
    el.textContent =
      `📍 ${mapName}   视角:${cam === 'third' ? '第三人称' : '第一人称'}   像素:${s.pixelSize}\n` +
      `点击画面锁定鼠标 · WASD 移动 · Shift 跑 · Space 跳 · V 切视角\n` +
      `1~${MAP_CARDS.length} 切换地图 · [ ] 像素大小 · O 描边` +
      (npc ? `\n💬 按 E 与 ${npc} 交谈` : '');
  };

  bus.on('map:loaded', ({ card }) => ((mapName = `${card.name} ${card.nameLocal}`), render()));
  bus.on('camera:mode', ({ mode }) => ((cam = mode), render()));
  bus.on('settings:changed', render);
  bus.on('npc:nearby', ({ npcId }) => ((npc = npcId), render()));
  bus.on('npc:interact', ({ npcId }) => console.info('[npc:interact]', npcId));

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
  render();
}
