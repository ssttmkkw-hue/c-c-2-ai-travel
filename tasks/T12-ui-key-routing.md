# T12 · UI 迁移到按键路由 + 收尾

- **状态**：done
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

- [x] `npm run build` 通过
- [x] `grep -rn "addEventListener('keydown'" src/ui src/npc` 没有结果
- [x] 任意打乱 main.ts 中几个 `mount*` 的顺序，以下都正常：开局护照 → Esc 关闭 → P 开设置 → P 关 → 和小樱对话时按 Tab/P/M 无反应 → 对话结束后 Tab 能开护照
- [x] 设置面板聚焦滑块时方向键能调值，Esc 能关闭面板
- [x] 滑块 / 复选框是像素风

## 完成记录（Cursor 填写）

- 做了什么：护照、设置、HUD、debugHud、对话框的快捷键全部改走 `keys.bind`（作用域 `game` / `passport` / `settings` / `dialogue`）。删掉各模块自己的 keydown 监听，以及 `passportOpen`、`syncPassport`、`syncModals`、`.passport` / `.settings` DOM 对账、对话框 `blockMenu`、`window.__dialogue`。HUD 交谈提示改问 `modals.any()`。对话框点击只听在 `.dialogue` 自身上。设置滑块 / 复选框改成方块、3px 硬边、无圆角无阴影（`-webkit-slider-*` 与 `-moz-range-*`）。对话关闭后 300ms 内，同一个 NPC 的 `npc:interact` 会被丢掉。`main.ts` 去掉两段挂载顺序注释（含 `TODO(T12)`），`mount*` 顺序改为 settings → hud → dialogue → passport → bubble → debugHud。
- 新增/修改文件：`src/ui/debugHud.ts`、`src/ui/passport/index.ts`、`src/ui/settings/index.ts`、`src/ui/settings/settings.css`、`src/ui/hud/index.ts`、`src/ui/dialogue/DialogueBox.ts`、`src/main.ts`、本卡、`tasks/README.md`。`src/npc/bubble.ts` 没有自己的 keydown，未改。
- 截图或说明：`npm run build` 通过；`grep -rn "addEventListener('keydown'" src/ui src/npc` 无结果。Headless Chrome 按打乱后的挂载顺序走了一遍：开局护照 → Esc 合上 → P 开设置 → 聚焦像素滑块方向键从 5 调到 4 → Esc 关掉 → 靠近小樱 E 开对话，此时 Tab/P/M 不开护照也不开设置 → 四句说完后 174ms 内再按 E 不会重开 → 冷却过后 Tab 能开护照。点击对话框正文能补全打字。设置面板滑块是方块拇指加硬边轨道，描边复选框是方角硬边。控制台无脚本报错。
- 遗留问题 / 需要 Claude 修改的地方：无。`game` 作用域绑定了 Esc（显隐齿轮），路由命中后会 `preventDefault`，指针锁是否随 Esc 退出由浏览器对这次默认动作的处理决定，`src/core/ui.ts` 未改。
- Code Bot headless 验证（截图 r2-t12-*.png）：在当前顺序和完全反转的 mount 顺序下各跑一遍完整流程，均 16/16 通过：开局护照 → Esc 关 → P 开设置 → 聚焦滑块方向键调值并写入 localStorage → Esc 关（滑块聚焦时）→ P/P 开关 → 对小樱按 E 开对话 → 对话中 Tab/P/M 无反应 → 点击对话框推进 → 播完关闭 → 关闭后立即按 E 不重开 → Tab 开护照 → 冷却后 E 能重开；控制台零报错；grep keydown 无结果。说明：点击推进用的是对话框打开时才出现的全屏透明层（任务卡允许的方案），所以对话中点画面任意位置都会推进。

## 审阅意见（Claude 填写）

**第 1 轮（2026-11-18）· 通过 ✅**

迁移干净：`src/ui`、`src/npc` 里已经没有 keydown 监听，也没有同步其他弹窗状态的代码，main.ts 的挂载顺序现在随意。我实测衣柜、护照、设置、对话框互相切换都正常。像素风滑块好看。

对话框点击画面任意位置都会推进：**接受**。视觉小说类对话框通常就是这样，而且对话期间本来就不该操作场景。
