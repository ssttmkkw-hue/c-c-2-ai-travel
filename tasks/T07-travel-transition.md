# T07 · 地图切换过场动画

- **状态**：review
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

5. 过场期间发 `ui:modal { id: 'transition', open }` 冻结玩家（这时所有快捷键自动失效，见 `src/core/ui.ts`）

## 验收清单

- [x] `npm run build` 通过
- [x] 连续快速切换地图不会卡在过场里（代码路径：重入作废上一轮计时；已盖满则立刻 resolve `waitFor`；8 秒看门狗强制收场。本环境没有浏览器，未做实机连按）

---

## 完成记录（Cursor 填写）

- 做了什么：全屏 Canvas 像素格子（约 24px）用目标卡 `palette.sky` / `accent[0]` 在约 0.48s 内盖满，盖满后 resolve `waitFor`（另有 2.5s 保底，短于 World 的 3s）。中央文案「✈ 前往 {地名} · {国家}」，Fusion Pixel、纸色底和 4px 硬边框，和护照同一套变量。`z-index: 40`，盖在护照之上。期间 `ui:modal { id: 'transition' }`。`map:loaded` 后保证总显示不少于 1.2s 再消散。开局 `from === null`（护照已打开）**跳过过场**，不调用 `waitFor`。新的 `map:loading` 会作废上一轮 hold/消散并立刻 settle 残留 promise；若格子已经铺满则同步放行。若始终等不到 `map:loaded`，8 秒后强制关掉，避免冻在过场里。
- 新增/修改文件：`src/ui/transition/index.ts`、`src/ui/transition/transition.css`、`src/main.ts`（`mountTransition` 一行，挂在护照之后）、`tasks/T07-travel-transition.md`、`tasks/README.md`
- 截图或说明：`npm run build` 通过（tsc + vite）。本环境没有浏览器，未做实机截图。
- 遗留问题 / 需要 Claude 修改的地方：无。开局策略是跳过过场；若希望第一次进东京也播过场，可以说一下再改。
- Code Bot headless 验证（r3-t07-*.png）：护照选吉萨 → 过场盖在护照之上，显示「✈ 前往 吉萨 · 埃及」，约 2s 后消散并到达；过场期间 modal 栈为 transition（玩家冻结、快捷键失效）；用 bus 每 150ms 连发 6 次 map:request，遮罩与 modal 同步，1.7s 后清空、最终停在最后请求的地图，之后可以正常移动；控制台零报错。注意：过场期间数字键本身会被按键路由屏蔽，所以“快速连按数字键”实际只触发第一次切换。

## 审阅意见（Claude 填写）
