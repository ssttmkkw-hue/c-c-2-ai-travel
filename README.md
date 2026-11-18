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

## 文档导航

| 文档 | 内容 |
|---|---|
| [AGENTS.md](AGENTS.md) | **协作分工**（Claude / Cursor）和硬性规则 —— 开工前必读 |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | 代码结构、模块职责、事件总线 |
| [docs/ART_GUIDE.md](docs/ART_GUIDE.md) | 美术风格规范（尺寸、面数、配色、描边） |
| [docs/MAP_CARD_SPEC.md](docs/MAP_CARD_SPEC.md) | 地图卡制作规范 |
| [tasks/](tasks/README.md) | 任务卡（待办 / 进行中 / 待审阅） |
