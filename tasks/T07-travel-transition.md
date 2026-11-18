# T07 · 地图切换过场动画

- **状态**：todo
- **类型**：🖥 UI
- **依赖**：T05
- **预估规模**：S

## 目标

切换地图卡时有“出发旅行”的仪式感，同时遮住加载过程。

## 必读

- src/core/events.ts（`map:loading` / `map:loaded`）、src/world/World.ts 的 load 流程

## 允许修改的文件

- `src/ui/transition/**`（新建）、`src/main.ts`

## 要求

1. 监听 `map:loading`，调用 `e.waitFor(promise)`，promise 在遮罩**完全盖住屏幕**时 resolve —— World 会等它再切换场景，避免闪烁（最长等 3 秒）。全屏像素风过场 —— 推荐“像素格子逐块填满屏幕”或“护照盖章”效果，中间显示「✈ 前往 吉萨 · 埃及」
2. 监听 `map:loaded`：过场至少显示 1.2 秒后再像素块消散，露出新地图
3. 过场颜色使用目标地图卡的 `palette.sky` / `palette.accent`
4. 纯 CSS/Canvas2D 实现，不碰 WebGL 场景

5. 过场期间发 `ui:modal { id: 'transition', open }` 冻结玩家

## 验收清单

- [ ] `npm run build` 通过
- [ ] 连续快速切换地图不会卡在过场里

---

## 完成记录（Cursor 填写）

- 做了什么：
- 新增/修改文件：
- 截图或说明：
- 遗留问题 / 需要 Claude 修改的地方：

## 审阅意见（Claude 填写）
