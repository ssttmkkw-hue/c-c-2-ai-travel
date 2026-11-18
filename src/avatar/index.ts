/**
 * 角色工厂。对外只暴露 createAvatar()，内部实现可整体替换。
 * 正式模型是 Q 版（chibi.ts）；placeholder.ts 保留作对照。
 */
import type { AvatarRig } from './types';
import { createChibiAvatar } from './chibi';

/** idle 为 true 时是站立版，四肢不会动，不能拿来走路 */
export function createAvatar(outfitId = 'default', opts?: { idle?: boolean }): AvatarRig {
  return createChibiAvatar(outfitId, opts);
}
