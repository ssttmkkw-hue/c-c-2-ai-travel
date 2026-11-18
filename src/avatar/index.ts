/**
 * 角色工厂。对外只暴露 createAvatar()，内部实现可整体替换。
 * 目前是占位小人（placeholder.ts），Cursor 在任务卡 T03 中用正式 Q 版模型替换。
 */
import type { AvatarRig } from './types';
import { createPlaceholderAvatar } from './placeholder';

export function createAvatar(outfitId = 'default'): AvatarRig {
  return createPlaceholderAvatar(outfitId);
}
