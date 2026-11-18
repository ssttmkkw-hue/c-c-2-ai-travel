/**
 * 服装注册表。颜色写在这里（收集用的服装色，不是场景调色板）。
 * 带帽子造型的套装不填 colors.hat，避免和 chibi 自带的扁帽叠在一起；配件由 buildAccessory 挂到头上。
 */
import { COLORS } from '@/art/colors';
import { keffiyeh, nemes, obi, parisLook, sailorCollar, strawHat, sugegasa } from './accessories';
import type { OutfitDef } from './types';

export const OUTFITS: OutfitDef[] = [
  { id: 'default', name: '旅行者', origin: 'default', colors: { top: '#f4f1e8', bottom: '#3d5a80', hat: '#e07a5f' } },
  {
    id: 'tokyo-yukata',
    name: '浴衣',
    origin: 'tokyo',
    colors: { top: '#2c4c7c', bottom: '#1c3054' },
    buildAccessory: () => obi('#c5364e', '#f0d078'),
  },
  {
    id: 'tokyo-student',
    name: '和风学生装',
    origin: 'tokyo',
    colors: { top: '#2a4580', bottom: '#1a2236' },
    buildAccessory: () => sailorCollar(COLORS.white, '#c23b4a'),
  },
  {
    id: 'tokyo-kasa',
    name: '斗笠',
    origin: 'tokyo',
    colors: { top: '#4d6a4a', bottom: '#3a332c' },
    buildAccessory: () => sugegasa('#c23b4a'),
  },
  {
    id: 'tokyo-straw',
    name: '草帽',
    origin: 'tokyo',
    colors: { top: '#7eafd6', bottom: '#c6a36a' },
    buildAccessory: () => strawHat('#c44536'),
  },
  {
    id: 'egypt-traveler',
    name: '头巾旅人装',
    origin: 'egypt',
    colors: { top: '#e7d3a4', bottom: '#6e4c32' },
    buildAccessory: () => keffiyeh('#f7f4ee', '#b33a32'),
  },
  {
    id: 'egypt-pharaoh',
    name: '法老戏装',
    origin: 'egypt',
    colors: { top: '#f3e2a0', bottom: '#f8f4ec' },
    buildAccessory: () => nemes('#1e4d8c', '#e6c35c', '#f0d078'),
  },
  {
    id: 'paris-stripe',
    name: '条纹衫',
    origin: 'paris',
    colors: { top: '#1e4d8c', bottom: '#1a1e28' },
    buildAccessory: () => parisLook('#243056', '#1e4d8c', '#f4f1e8', '#c44536', '#f7f4ee'),
  },
];

export function getOutfit(id: string): OutfitDef {
  return OUTFITS.find((o) => o.id === id) ?? OUTFITS[0];
}
