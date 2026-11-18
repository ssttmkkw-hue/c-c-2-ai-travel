# 架构

```
src/
├── main.ts              入口：组装 Engine / World / Player / UI
├── core/                🔒 引擎层
│   ├── Engine.ts        渲染器、主循环、渲染管线（离屏渲染 → 整数倍放大到物理像素）
│   ├── Input.ts         键鼠输入、pointer lock
│   ├── events.ts        全局事件总线 bus（类型安全）
│   ├── ui.ts            弹窗栈 modals + 按键路由 keys.bind（UI 快捷键唯一入口）
│   └── settings.ts      玩家设置（画面风格、像素颗粒、画质、描边、灵敏度），持久化
├── render/              🔒 风格层
│   ├── toon.ts          卡通材质（3 阶硬阴影）、反向外壳描边（屏幕空间恒定粗细）、阴影补丁
│   ├── quality.ts       画质档位表、渲染分辨率计算 computeView()
│   └── palette.ts       调色板类型
├── art/
│   ├── kit.ts           🔒 基础件：box / cylinder / cone / ball / prism / group / place
│   ├── colors.ts        🎨 材质固有色
│   └── props/           🎨 道具库
├── world/
│   ├── MapCard.ts       🔒 地图卡契约（MapCardDef / MapBuildContext）
│   ├── World.ts         🔒 地图加载卸载、调色板 → 灯光雾天空、碰撞盒
│   ├── registry.ts      地图卡注册表
│   └── rng.ts           可复现随机数
├── maps/<id>/           🎨 每张地图卡：index.ts + palette.ts（+ 自己的局部模块）
├── player/              🔒 玩家移动、碰撞、相机（第一/第三人称）
├── avatar/              角色：types.ts 🔒，其余 🎨
├── npc/                 NPC：types.ts 🔒，spawn.ts 生成
├── ui/                  🎨 界面（目前只有临时 debugHud）
└── fx/                  🎨 环境特效（待建）
```

## 数据流

```
UI ──bus.emit('map:request')──▶ World.load()
                                  ├─ emit 'map:loading'  （过场动画开始）
                                  ├─ 应用调色板（天空/雾/灯光/描边色）
                                  ├─ card.build(ctx)     （地图卡往场景里加东西）
                                  ├─ spawnNpcs()
                                  └─ emit 'map:loaded'   → Player 传送到出生点、UI 更新
Player ──每帧──▶ 移动/碰撞 → CameraRig → 检测附近 NPC → emit 'npc:nearby' / 'npc:interact'
```

## 事件一览（`src/core/events.ts`）

| 事件 | 发出方 | 用途 |
|---|---|---|
| `map:request {id}` | UI | 请求切换地图卡 |
| `map:loading {from,to}` | World | 开始加载（过场动画） |
| `map:loaded {card}` | World | 加载完成 |
| `settings:changed` | settings | 设置变化 |
| `render:view` | Engine | 渲染分辨率变化（内部分辨率、放大倍数），UI 显示用 |
| `camera:mode {mode}` | CameraRig | 视角切换 |
| `npc:nearby {npcId}` | Player | 附近可交互 NPC 变化 |
| `npc:interact {npcId}` | Player | 按 E 交互 |
| `outfit:equip {outfitId}` | 衣柜 UI | 换装 |
| `ui:modal {id, open}` | 任意弹窗 UI | 打开时冻结玩家输入、释放鼠标 |

`map:loading` 带 `waitFor(promise)`：过场动画用它让 World 等遮罩盖满后再切场景。

需要新事件？在任务卡完成记录里提出，由 Claude 添加。

## 关键约束

- **像素化**：画布后备缓冲 = 物理像素（CSS 尺寸 × devicePixelRatio）。场景先渲染到离屏缓冲（`engine.view.width × height`），
  像素风下再用最近邻**整数倍**放大到画布；高清模式 1:1 + MSAA。分辨率怎么算都在 `src/render/quality.ts`。
  要内部分辨率读 `engine.view`，不要读 `renderer.domElement.width`（那是物理像素）。
- **UI**：所有 UI 都是 HTML 叠在 `#ui` 上，不受像素化影响。`#ui` 有整体 CSS zoom（`src/ui/scale.ts`），
  保证 12px 点阵字体落在整数物理像素上：**字号只用 12px / 24px**；在 `#ui` 里用 JS 设像素坐标时要除以 `uiZoom()`。
- **碰撞**：只有 XZ 平面的轴对齐盒（AABB）。地面固定 y=0。旋转过的物体会用其包围盒，
  所以斜放的大物体请手动 `ctx.addCollider()` 更贴合的盒子。
- **材质**：`toonMaterial()` 全局按颜色缓存，卸载地图时不释放材质，只释放几何体。
- **性能目标**：普通笔记本 60fps。单张地图建议 < 1500 个 mesh（描边算一个）。
  大量重复物体（草、花瓣）用 `InstancedMesh`：静态的用 `kit.instances`，飘落粒子在 `src/fx/` 中实现。
- **静态合批**：`card.build()` 之后 World 调 `batchStatic`（`src/render/batch.ts`），不动的零件按「顶点色」合并，
  一张图的 draw call 约 100 次（其中角色每个约 25 次）。会动的物体必须用 `kit.dynamic()` 标记。
