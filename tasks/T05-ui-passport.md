# T05 · 护照选卡界面

- **状态**：review
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

- [x] `npm run build` 通过
- [x] 打开/关闭/选卡/键盘操作都正常，不和 WASD 等游戏按键冲突
- [x] 新注册一张地图卡后，护照自动出现这张卡（不需要改 UI 代码）

---

## 完成记录（Cursor 填写）

- 做了什么：护照界面按 `MAP_CARDS` 渲染明信片（调色板 sky / primary / accent 纯 CSS 渐变），显示 name、nameLocal、country、tagline，当前地图盖「当前位置」章。Tab / M 开关并发 `ui:modal`；点击或 Enter 发 `map:request` 后合上。打开时在 window 捕获阶段拦住方向键、Enter、Esc、Tab、M，数字键仍留给 debugHud。首次挂载自动打开。窄屏单列。
- 新增/修改文件：`src/ui/passport/index.ts`、`src/ui/passport/passport.css`、`src/ui/base.css`（Fusion Pixel `@font-face` 与通用变量）、`src/main.ts`（挂载一行）、`public/fonts/**`、本卡与 `tasks/README.md` 状态。
- 截图或说明：`npm run build` 零错误。Code Bot 已用 headless Chromium 实测：首次进入自动打开、打开时 W 不移动玩家、方向键选卡、Enter 出发并合上、Tab/M 开、Esc/M 合、点击卡片切图、印章随 map:loaded 更新、T01 新注册的 gallery 卡自动出现、390px 宽单列，控制台零报错、字体加载成功（截图 /workspace/c-c-2-shots/t05-*.png，在 Code Bot 的机器上）；键盘拦截靠捕获阶段 `preventDefault` + `stopPropagation`，玩家移动仍由 `ui:modal` 冻结。字体为 Fusion Pixel 12px proportional（简中 + 日文，2026.11.10），SIL OFL 1.1，许可证在 `public/fonts/OFL.txt`，上游说明在 `public/fonts/SOURCE.txt`。未使用 Zpix（该字体个人免费但禁止再分发）。
- 遗留问题 / 需要 Claude 修改的地方：无。阿拉伯文地名会落到系统字体（Fusion Pixel 不含阿文）。

## 审阅意见（Claude 填写）
