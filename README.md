# AI Travel · 像素卡通世界旅行

切换「地图卡」去世界各地旅行的网页 3D 小游戏。
风格：**低多边形 + 卡通着色（三渲二）+ 像素化渲染**，每张地图卡一套调色板。

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # 类型检查 + 打包
```

操作：点击画面锁定鼠标 · WASD 移动 · Shift 跑 · Space 跳 · V 切换第一/第三人称 · E 与 NPC 交谈
开发快捷键：1~9 切换地图卡 · `[` `]` 调像素颗粒 · `\` 切换像素风 / 高清 · O 开关描边
画面设置（按 P）：画面风格（像素风 / 高清）· 像素颗粒 · 画质

## 视觉回归

开发服务器开着（默认 `http://localhost:5173`）时：

```bash
npm run shots                 # 和 tools/baseline/ 里的基准图逐像素比对
node tools/visual-check.mjs --update   # 用当前画面覆盖基准图（改了云、水、光照之后）
```

脚本用 Playwright 打开 640×400、`?autoquality=0`，swiftshader 软件渲染。每张图固定出生点附近的镜头，并调用 `__game.engine.freezeVisual(1.5)` 把模拟时间停在 1.5 秒（粒子、云、水面不再走）。界面层会藏起来，只比 3D 画面。单通道差过 18 算一个不同像素，超过约 1.5% 就失败。差异图写到 `tools/diff/`（不进 git）。基准图是在这台无显卡的 headless Chromium 上截的，换 GPU 或改渲染都会对不上，需要重新 `--update`。

## 文档导航

| 文档 | 内容 |
|---|---|
| [AGENTS.md](AGENTS.md) | **协作分工**（Claude / Cursor）和硬性规则 —— 开工前必读 |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | 代码结构、模块职责、事件总线 |
| [docs/ART_GUIDE.md](docs/ART_GUIDE.md) | 美术风格规范（尺寸、面数、配色、描边） |
| [docs/MAP_CARD_SPEC.md](docs/MAP_CARD_SPEC.md) | 地图卡制作规范 |
| [tasks/](tasks/README.md) | 任务卡（待办 / 进行中 / 待审阅） |
