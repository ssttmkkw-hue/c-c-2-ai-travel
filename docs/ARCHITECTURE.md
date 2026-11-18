# 架构

```
src/
├── main.ts              入口：组装 Engine / World / Player / UI
├── core/                🔒 引擎层
│   ├── Engine.ts        渲染器、主循环、像素化（低分辨率画布 + CSS pixelated 放大）
│   ├── Input.ts         键鼠输入、pointer lock
│   ├── events.ts        全局事件总线 bus（类型安全）
│   └── settings.ts      玩家设置（像素大小、描边、灵敏度），持久化
├── render/              🔒 风格层
│   ├── toon.ts          卡通材质（3 阶硬阴影）、反向外壳描边
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
| `camera:mode {mode}` | CameraRig | 视角切换 |
| `npc:nearby {npcId}` | Player | 附近可交互 NPC 变化 |
| `npc:interact {npcId}` | Player | 按 E 交互 |
| `outfit:equip {outfitId}` | 衣柜 UI | 换装 |
| `ui:modal {id, open}` | 任意弹窗 UI | 打开时冻结玩家输入、释放鼠标 |

`map:loading` 带 `waitFor(promise)`：过场动画用它让 World 等遮罩盖满后再切场景。

需要新事件？在任务卡完成记录里提出，由 Claude 添加。

## 关键约束

- **像素化**：画布分辨率 = 窗口 / pixelSize。所有 UI 都是 HTML 叠在 `#ui` 上，不受像素化影响。
  如果想让 UI 也有像素感，用像素字体 + 无抗锯齿的 CSS（`image-rendering: pixelated`）。
- **碰撞**：只有 XZ 平面的轴对齐盒（AABB）。地面固定 y=0。旋转过的物体会用其包围盒，
  所以斜放的大物体请手动 `ctx.addCollider()` 更贴合的盒子。
- **材质**：`toonMaterial()` 全局按颜色缓存，卸载地图时不释放材质，只释放几何体。
- **性能目标**：普通笔记本 60fps。单张地图建议 < 1500 个 mesh（描边算一个）。
  大量重复物体（草、花瓣）用 `InstancedMesh`，在 `src/fx/` 中实现。
