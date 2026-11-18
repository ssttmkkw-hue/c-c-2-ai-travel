# T10 · NPC 对话框

- **状态**：review
- **类型**：🖥 UI
- **依赖**：—
- **预估规模**：S

## 目标

靠近 NPC 按 E 弹出对话框，逐句显示 `NpcDef.lines`。这是之后 **AI 导游**（Claude 负责）的显示层，所以接口要干净。

## 必读

- src/npc/types.ts、src/core/events.ts（`npc:nearby` / `npc:interact`）、src/world/World.ts（`world.current.npcs`）

## 允许修改的文件

- `src/ui/dialogue/**`（新建）、`src/npc/bubble.ts`（新建，可选）、`src/main.ts`

## 要求

1. 新建 `src/ui/dialogue/DialogueBox.ts`，对外 API：
   ```ts
   open(speaker: string): void
   /** 打字机效果追加文本；返回 Promise 在打字完成时 resolve */
   say(text: string): Promise<void>
   /** 流式追加（AI 导游会逐 token 调用） */
   append(chunk: string): void
   /** 显示选项按钮，返回选中的索引 */
   choose(options: string[]): Promise<number>
   close(): void
   ```
2. 监听 `npc:interact`：从 `MAP_CARDS` + `map:loaded` 记录的当前卡里找到 NpcDef，依次 `say(lines[i])`，按 E / 空格 / 点击 → 下一句；最后一句后关闭
3. 打字机效果中再按 E 直接显示整句
4. `open()` / `close()` 时发 `bus.emit('ui:modal', { id: 'dialogue', open })`，玩家会被冻结。注意：冻结后 Player 不再发 `npc:interact`，所以“下一句”要由对话框自己监听按键
5. 风格：屏幕下方像素风对话框，左侧显示说话人名字牌
6. （可选）`src/npc/bubble.ts`：附近 NPC 头顶出现像素“💬”提示（用 HTML 叠加 + 投影坐标，或 Sprite）

## 验收清单

- [x] `npm run build` 通过
- [x] 东京小樱可以对话，台词完整播放（逻辑已接 `tokyo-guide` 的四句台词；本环境没有浏览器，未在画面里点）
- [x] DialogueBox 的 5 个 API 都能在控制台手动调用测试（实例在 `window.__dialogue`，未在浏览器里点按）

---

## 完成记录（Cursor 填写）

- 做了什么：底部像素对话框（Fusion Pixel、硬边框、左侧名字牌）。`open` / `close` 发 `ui:modal` id `dialogue`。`say` 打字机，播完 resolve；打字中 E / 空格 / 点击补全整句，整句显示后再按才下一句，最后一句确认后关闭。`append` 延长当前句，`choose` 出选项。`npc:interact` 用 `map:loaded` 的当前卡（找不到再扫 `MAP_CARDS`）播 `lines`。实例挂在 `window.__dialogue`。可选气泡：附近 NPC 头顶「💬」，对话框打开时藏起。
- 新增/修改文件：`src/ui/dialogue/DialogueBox.ts`、`dialogue.css`、`index.ts`，`src/npc/bubble.ts`，`src/main.ts`（对话框在 HUD 之前挂载，气泡在护照之后），本卡与 `tasks/README.md` 状态表。
- 截图或说明：`npm run build` 通过。控制台可试 `__dialogue.open('小樱'); await __dialogue.say('你好'); await __dialogue.choose(['走','留'])`。HUD 的「按 E 交谈」监听任意 `ui:modal`，`modals.size > 0` 时 `talk.hidden`，对话框打开会藏提示，位置也不叠（提示在 18% 高，对话框贴底）。
- 遗留问题 / 需要 Claude 修改的地方：设置只在护照打开时忽略 P，护照完全不看 `ui:modal`。只发 `ui:modal` 挡不住 P / Tab / M。当前变通是对话框**先于**设置和护照注册捕获监听，打开时对 E、空格、点击以及 P / Tab / M / Esc 使用 `stopImmediatePropagation`。若以后有人把 `mountDialogue` 挪到这两处后面，菜单键会又打开设置或护照，需要它们也认 `id: 'dialogue'`。没有改 hud / settings / passport。本环境没有浏览器，小樱对白没有在画面里点过。
- Code Bot headless 验证（截图 /workspace/c-c-2-shots/t10-*.png，在 Code Bot 机器上）：靠近小樱按 E 打开，打字中按 E 补全整句，空格逐句推进，4 句播完后关闭；对话中 W 不移动、P/M 不打开设置/护照；控制台 `__dialogue` 的 open/say/append/choose/close 全部可用（choose 点选项 B 返回 1）；控制台零报错。
- 请 Claude 看：对话框靠挂载顺序 + stopImmediatePropagation 拦住 P/Tab/M/Esc，和 T06 一样依赖 main.ts 挂载顺序；建议之后统一一个 modal 栈/按键路由。`window.__dialogue` 是调试用全局。

## 审阅意见（Claude 填写）
