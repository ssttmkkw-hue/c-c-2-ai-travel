/**
 * 地图卡注册表。新增地图卡后在这里 import 并加入数组。
 * 数组顺序 = 护照/选卡界面中的显示顺序。
 */
import type { MapCardDef } from './MapCard';
import tokyo from '@/maps/tokyo';
import egypt from '@/maps/egypt';
import paris from '@/maps/paris';
import gallery from '@/maps/gallery';

export const MAP_CARDS: MapCardDef[] = [tokyo, egypt, paris, gallery];

export function getCard(id: string): MapCardDef | undefined {
  return MAP_CARDS.find((c) => c.id === id);
}
