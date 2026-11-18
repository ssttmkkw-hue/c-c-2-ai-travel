/**
 * 服装注册表。Cursor：每做一张地图卡，就在这里加至少一套当地服装（任务卡 T04）。
 */
import type { OutfitDef } from './types';

export const OUTFITS: OutfitDef[] = [
  { id: 'default', name: '旅行者', origin: 'default', colors: { top: '#f4f1e8', bottom: '#3d5a80', hat: '#e07a5f' } },
];

export function getOutfit(id: string): OutfitDef {
  return OUTFITS.find((o) => o.id === id) ?? OUTFITS[0];
}
