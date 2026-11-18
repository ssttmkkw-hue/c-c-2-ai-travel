# T05 · 护照选卡界面

- **状态**：todo
- **类型**：🖥 UI
- **依赖**：—
- **预估规模**：M

## 目标

旅行的核心入口：一本“护照”，翻开能看到所有地图卡，点一张就出发。

## 必读

- AGENTS.md（UI 只能通过 bus 和游戏交互）
- src/core/events.ts、src/world/registry.ts（MAP_CARDS 数据）、src/world/MapCard.ts
- src/ui/base.css、src/ui/debugHud.ts

## 允许修改的文件

- `src/ui/passport/**`（新建）、`src/ui/base.css`（加通用变量）
- `src/main.ts`（挂载一行）
- `public/fonts/**`（如引入开源像素字体，需注明许可证）

## 要求

1. 按 **Tab** 或 **M** 打开 / 关闭（Tab 要 `preventDefault`）；打开/关闭时发 `bus.emit('ui:modal', { id: 'passport', open })`，玩家会被冻结并释放鼠标
2. 视觉：像素风护照本，每张地图卡是一张“明信片/卡片”：
   - 用调色板的 sky + primary + accent 生成卡面渐变 / 图案（纯 CSS，不需要截图）
   - 显示 name、nameLocal、country、tagline
   - 当前所在地图的卡片有「当前位置」印章
3. 点击卡片 → `bus.emit('map:request', { id })` → 关闭护照
4. 监听 `map:loaded` 更新当前位置
5. 键盘可操作：方向键选择、Enter 出发、Esc 关闭
6. 适配手机竖屏宽度（卡片换成单列）
7. UI 像素感：像素字体（推荐开源 Zpix / Fusion Pixel，放 `public/fonts`），按钮/边框用 2~4px 硬边框，不要圆角阴影
8. 首次进入游戏时自动打开护照（作为开始界面），关闭后才开始玩

## 验收清单

- [ ] `npm run build` 通过
- [ ] 打开/关闭/选卡/键盘操作都正常，不和 WASD 等游戏按键冲突
- [ ] 新注册一张地图卡后，护照自动出现这张卡（不需要改 UI 代码）

---

## 完成记录（Cursor 填写）

- 做了什么：
- 新增/修改文件：
- 截图或说明：
- 遗留问题 / 需要 Claude 修改的地方：

## 审阅意见（Claude 填写）
