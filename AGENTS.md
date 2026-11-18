# 协作分工 & 规则（Cursor 必读）

本项目由两个 AI 协作：

| 角色 | 负责 |
|---|---|
| **Claude**（架构 / 审阅） | 核心框架、接口契约、任务卡编写、代码审阅、AI 导游等关键系统 |
| **Cursor**（实现） | 按任务卡实现：**美术建模（重点）**、地图卡内容、UI、特效、服装 |

流程：Claude 写任务卡 → Cursor 实现 → 任务卡状态改成 `review` → 人类请 Claude 审阅 → `done`。
任务卡在 [`tasks/`](tasks/README.md)。

## Cursor 开工步骤

1. 读 `tasks/README.md`，挑一张状态为 `todo` 且依赖已完成的任务卡
2. 把任务卡的 `状态` 改为 `doing`
3. 读任务卡里列出的「必读文档」和「相关文件」
4. 只在任务卡「允许修改的文件」范围内改动
5. 完成后：`npm run build` 必须通过；在浏览器里跑一遍验收清单；
   在任务卡底部「完成记录」里写：做了什么、截图/说明、遗留问题；状态改为 `review`

## 硬性规则

1. **不要修改「🔒 Claude 保留区」的文件**。如果确实需要改接口，在任务卡「完成记录」里写“需要 Claude 修改：…”，然后用变通方案或先停下。
2. **所有颜色来自调色板**（`ctx.palette` / 地图卡的 `palette.ts`）。不要在模型代码里散落 `#xxxxxx`（角色肤色、木头/石头等“材质固有色”可以集中写在 `src/art/colors.ts`）。
3. **所有模型用 `src/art/kit.ts` 的函数拼**（box / cylinder / cone / ball / group）。不要直接 `new MeshStandardMaterial`，不要加载外部贴图或 glTF 模型（除非任务卡明确允许）。
4. **系统之间用 `bus`（`src/core/events.ts`）通信**。UI 不直接调用 World / Player 的方法。
5. 不引入新的 npm 依赖（除非任务卡允许）。
6. TypeScript strict，`npm run build` 零错误。
7. 注释和 UI 文案用中文。

## 🔒 Claude 保留区（Cursor 只读）

```
src/core/**            引擎、输入、事件总线、设置
src/render/**          卡通材质、描边、调色板类型
src/world/MapCard.ts   地图卡契约
src/world/World.ts     地图加载 / 碰撞
src/player/**          玩家移动、相机
src/avatar/types.ts    角色接口
src/npc/types.ts       NPC 接口
src/art/kit.ts         美术基础件（可以提议新增函数）
src/main.ts            入口（新 UI 模块的挂载可以加一行，需在完成记录中说明）
AGENTS.md / docs/** / tasks/README.md
```

`src/world/registry.ts` 例外：新增地图卡时可以加 import 和数组项。

## 🎨 Cursor 工作区

```
src/art/props/**       通用道具库（树、路灯、长椅、建筑...）
src/art/colors.ts      材质固有色（肤色、木、石、金属）
src/maps/<id>/**       各地图卡
src/avatar/**          角色模型、动画、服装（types.ts 除外）
src/npc/spawn.ts 之外的 NPC 表现层（如对话气泡）
src/ui/**              所有界面
src/fx/**              环境特效（粒子、云、水）
src/audio/**           音效 / BGM（若有任务卡）
```
