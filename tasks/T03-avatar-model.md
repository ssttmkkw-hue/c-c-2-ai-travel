# T03 · Q 版角色模型 + 程序动画

- **状态**：todo
- **类型**：🎨 美术
- **依赖**：—
- **预估规模**：M

## 目标

替换 `src/avatar/placeholder.ts` 的方块小人，做一个可爱的 Q 版低模角色，玩家和 NPC 共用。

## 必读

- src/avatar/types.ts（**AvatarRig 接口必须完整实现**）
- src/avatar/placeholder.ts、src/avatar/outfits.ts
- docs/ART_GUIDE.md

## 允许修改的文件

- `src/avatar/**`（types.ts 除外）

## 要求

1. 新建 `src/avatar/chibi.ts` 导出 `createChibiAvatar(outfitId): AvatarRig`，并在 `src/avatar/index.ts` 中切换为它（placeholder.ts 保留不删）
2. 造型：身高 ≈ 1.2m，大头（头宽约为身体 1.3 倍），简单的眼睛（两个深色小方块/小球，不描边），头发 = 几块拼的低模发型，手臂、腿各分上下两段（或一段）
3. 层级：root → hips → (torso → head, armL, armR), legL, legR。**关节的旋转中心要在关节处**（用空 Group 当关节）
4. 程序动画（`animate(dt, speed, airborne)`）：
   - 待机：轻微呼吸（torso 上下 1~2cm），偶尔眨眼
   - 走路：腿前后摆、手臂反向摆、身体轻微上下颠，幅度随 speed 变化（走 4m/s、跑 7.5m/s 要有区别，跑步身体前倾）
   - 空中：手臂张开、腿收起
   - 动作之间平滑过渡（不要瞬间跳变）
5. `setOutfit(id)`：按 OutfitDef 换上衣/下装/帽子颜色，有 `buildAccessory` 时挂到 head 上（换装时先移除旧配件）
6. 肤色从 `COLORS.skin` 取，可以让 OutfitDef 之外的参数决定（先固定 skin[0] 即可）

## 验收清单

- [ ] `npm run build` 通过
- [ ] 第三人称下走、跑、跳、站立动画自然
- [ ] 东京地图的 NPC 也自动换成新模型
- [ ] 第一人称时角色隐藏（已由 Player 处理，确认没有被破坏）
- [ ] 像素大小 4 下脸部仍能看出是“脸”

## 不要做

- 不要用骨骼动画 / glTF，全部用 Group 层级 + 代码旋转
- 不要修改 Player.ts

---

## 完成记录（Cursor 填写）

- 做了什么：
- 新增/修改文件：
- 截图或说明：
- 遗留问题 / 需要 Claude 修改的地方：

## 审阅意见（Claude 填写）
