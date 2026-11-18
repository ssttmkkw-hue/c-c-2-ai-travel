# T12 · UI 迁移到按键路由 + 收尾

- **状态**：todo
- **类型**：🖥 UI
- **依赖**：T05、T06、T10
- **预估规模**：M

## 目标

现在护照、设置、对话框、HUD 各自在 window 上监听 keydown，互相通过 DOM 猜对方是否打开，正确性依赖 main.ts 的挂载顺序。
Claude 已在 `src/core/ui.ts` 加了统一的**弹窗栈 `modals` + 按键路由 `keys.bind`**，本任务把所有 UI 迁移过去，并顺手收尾 T06/T10 审阅中的小问题。

## 必读

- `src/core/ui.ts`（顶部注释里有用法和路由规则）
- AGENTS.md 硬性规则第 4 条（已更新）

## 允许修改的文件

- `src/ui/**`、`src/npc/bubble.ts`、`src/main.ts`（只删 TODO(T12) 注释和调整挂载）

## 要求

1. **按键全部走 `keys.bind`**，删掉各模块自己的 `window.addEventListener('keydown', …)`：
   - debugHud：`keys.bind('game', ['Digit1'…'Digit9', 'BracketLeft', 'BracketRight', 'KeyO'], …)`
   - 护照：`game` 作用域 Tab/M 打开；`passport` 作用域 Esc/Tab/M 关闭、方向键、Enter
   - 设置：`game` 作用域 P 打开、Esc 显示/隐藏齿轮；`settings` 作用域 P/Esc 关闭
   - 对话框：`dialogue` 作用域 E/Space/Enter 推进，选项时方向键
   - HUD：`game` 作用域 H
2. **删掉所有“同步其他弹窗状态”的代码**：`passportOpen`、`syncPassport`、`syncModals`、DOM 查询 `.passport` / `.settings`、对话框里专门拦截 P/Tab/M 的 `blockMenu`。需要判断时用 `modals.any()` / `modals.isOpen(id)`
3. 删掉 main.ts 中关于挂载顺序的两段注释（含 `TODO(T12)`），挂载顺序随意也要能正常工作
4. 删掉 `window.__dialogue`（Claude 已在 main.ts 把 `dialogue` 放进了 dev 模式的 `__game`）
5. 对话框的鼠标点击推进：现在是 window 捕获阶段拦截**所有**点击，改成只监听对话框元素自身（或一个只在对话框打开时出现的全屏透明层）
6. **设置面板滑块改成像素风**：自定义 `input[type=range]` 的轨道和滑块（方块滑块、2~4px 硬边框、无圆角无阴影），复选框同理。注意 `-webkit-` 和 `-moz-` 两套伪元素
7. 刚关闭对话框的同一帧 / 0.3 秒内按 E 不要立刻重新打开同一个 NPC 的对话（加一个短冷却）

## 验收清单

- [ ] `npm run build` 通过
- [ ] `grep -rn "addEventListener('keydown'" src/ui src/npc` 没有结果
- [ ] 任意打乱 main.ts 中几个 `mount*` 的顺序，以下都正常：开局护照 → Esc 关闭 → P 开设置 → P 关 → 和小樱对话时按 Tab/P/M 无反应 → 对话结束后 Tab 能开护照
- [ ] 设置面板聚焦滑块时方向键能调值，Esc 能关闭面板
- [ ] 滑块 / 复选框是像素风
