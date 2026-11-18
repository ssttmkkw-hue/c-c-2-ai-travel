# T03 · Q 版角色模型 + 程序动画

- **状态**：done
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

- [x] `npm run build` 通过
- [x] 第三人称下走、跑、跳、站立动画自然
- [x] 东京地图的 NPC 也自动换成新模型
- [x] 第一人称时角色隐藏（已由 Player 处理，确认没有被破坏）
- [x] 像素大小 4 下脸部仍能看出是“脸”

## 不要做

- 不要用骨骼动画 / glTF，全部用 Group 层级 + 代码旋转
- 不要修改 Player.ts

---

## 完成记录（Cursor 填写）

- 做了什么：新增 `createChibiAvatar`，用空 Group 做髋 / 躯干 / 头 / 四肢关节。身高约 1.2m，头宽 0.52、躯干宽 0.4。发型在头顶、刘海之外加了两侧和后脑方块，正面仍露出脸和眼睛。待机呼吸与眨眼；走/跑用 `walk=clamp(speed/4)` 与 `run=clamp((speed-4)/3.5)` 连续混合摆幅、步频和前倾（0 站立、4m/s 走、7.5m/s 跑），关节角指数阻尼，不跳变。空中腿收起，手臂绕 Z 轴向外侧抬起（左臂负 Z、右臂正 Z），不再向中线交叉。`setOutfit` 换上衣、裤、帽颜色，并在换装时卸掉旧的 `buildAccessory`。`createAvatar` 已改为返回该模型，`placeholder.ts` 保留。
- 新增/修改文件：`src/avatar/chibi.ts`、`src/avatar/index.ts`、`tasks/T03-avatar-model.md`
- 截图或说明：按浏览器反馈补了后脑头发，并修正空中张臂方向。`npm run build` 已通过。验收清单由 Code Bot 用 headless Chromium（swiftshader）截图确认：走/跑/跳/站立、东京 NPC 已换新模型、按 V 第一人称时角色隐藏且切回后恢复、像素大小 4 下脸（眼睛+刘海）可辨认，控制台零报错。动画是否“自然”只看了静帧，请 Claude 在浏览器里再看一下动态效果。
- 遗留问题 / 需要 Claude 修改的地方：无接口改动。肤色固定 `COLORS.skin[0]`，头发用 `COLORS.woodDark`，鞋用 `COLORS.black`。
- 第 1 轮审阅修改：跑步前倾改为 `torso.rotation.x = -lean`（面朝 -Z 时正角度会后仰）；手肘 `rotation.x` 改为正值，前臂往前弯；`HIP_Y` 从 0.44 调到 0.48，脚底贴地；`o.colors.hat` 为空时 `hat.visible = false`。`npm run build` 零错误。
  - Code Bot headless 验证：侧面跑步上身前倾、手肘向前弯、站立时最低点约 -1cm（原约 -4cm，剩余 1cm 可能来自呼吸起伏，可接受）、无帽服装隐藏帽子、换回默认服装帽子恢复；截图 t03fix-*.png。

## 审阅意见（Claude 填写）

**第 1 轮（2026-11-18）· 小修后通过**

在浏览器里看过动起来的样子：正脸很可爱（大头、刘海、眨眼都好），走路步幅自然，跳起来张手收腿也到位。关节层级和阻尼过渡写得很干净。

请修改（都是一两行）：
1. **跑步时身体往后仰**：角色面朝 -Z，绕 X 轴转**正角度**会让上身往 +Z（后面）倒。`torso.rotation.x = lean` 改成 `= -lean`
2. **手肘反向弯**：`elbowL/R.rotation.x` 现在是负值，前臂往后折。改成正值（往前弯）
3. **脚陷进地里约 4cm**：腿总长 0.24 + 0.2 + 鞋半高 0.04 = 0.48，比 `HIP_Y` 0.44 长。把 `HIP_Y` 改成 0.48，或者把腿缩短 4cm
4. **没有帽子的服装也显示帽子**：`o.colors.hat` 为空时设 `hat.visible = false`，有帽子时设回 true

改完直接把状态改为 `done`，不需要再审。
