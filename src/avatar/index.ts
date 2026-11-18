/**
 * 角色工厂。对外只暴露 createAvatar()，内部实现可整体替换。
 * 正式模型是 Q 版（chibi.ts）；placeholder.ts 保留作对照。
 */
import type { AvatarRig } from './types';
import { createChibiAvatar } from './chibi';

export function createAvatar(outfitId = 'default'): AvatarRig {
  return createChibiAvatar(outfitId);
}
