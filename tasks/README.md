# 任务看板

状态：`todo` 待做 · `todo（小修）` 审阅后小改，改完直接 `done` · `doing` 进行中 · `review` 待 Claude 审阅 · `done` 完成 · `blocked` 卡住（写明原因）

**Cursor**：挑 `todo` 且「依赖」都已 `done` 的卡（依赖为 `review` 也可以先开工）。改状态时**同时更新本表和任务卡头部**。
**Claude**：审阅 `review` 的卡，通过 → `done`，不通过 → 在卡底部写审阅意见，状态回 `todo`。

| ID | 任务 | 类型 | 依赖 | 状态 |
|---|---|---|---|---|
| [T01](T01-props-library.md) | 通用道具库 | 🎨 美术 | — | done |
| [T02](T02-map-tokyo.md) | 东京地图卡完整版 | 🎨 美术 | T01 | done |
| [T03](T03-avatar-model.md) | Q 版角色模型 + 程序动画 | 🎨 美术 | — | done |
| [T04](T04-outfits.md) | 服装系统 + 当地服装 | 🎨 美术 | T03 | done |
| [T05](T05-ui-passport.md) | 护照选卡界面 | 🖥 UI | — | done |
| [T06](T06-ui-settings-hud.md) | 设置面板 + 正式 HUD | 🖥 UI | — | done |
| [T07](T07-travel-transition.md) | 地图切换过场动画 | 🖥 UI | T05 | todo |
| [T08](T08-map-giza.md) | 吉萨地图卡完整版 | 🎨 美术 | T01 | todo |
| [T09](T09-map-paris.md) | 巴黎地图卡（新） | 🎨 美术 | T01 | todo |
| [T10](T10-npc-dialogue.md) | NPC 对话框 | 🖥 UI | — | done |
| [T11](T11-ambient-fx.md) | 环境特效（花瓣/沙尘/云） | ✨ 特效 | — | todo |
| [T12](T12-ui-key-routing.md) | UI 迁移到按键路由 + 收尾 | 🖥 UI | T05, T06, T10 | done |

建议顺序（当前）：T07 / T08 / T09 / T11 可并行

## Claude 保留任务（Cursor 不做）

- AI 导游：接入大模型，根据 `NpcDef.guide` 实时讲解（等 T10 对话框完成后接入）
- 存档系统（旅行记录、已收集服装、护照印章）
- 后期效果管线（调色板量化 / 抖动 / 边缘检测描边）
- 碰撞升级（可以站到物体上、斜坡）
- 泛光（bloom）后期：让霓虹、灯笼真正发光

新任务卡模板：[_TEMPLATE.md](_TEMPLATE.md)
