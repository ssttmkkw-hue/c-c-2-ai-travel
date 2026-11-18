# T10 · NPC 对话框

- **状态**：todo
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

- [ ] `npm run build` 通过
- [ ] 东京小樱可以对话，台词完整播放
- [ ] DialogueBox 的 5 个 API 都能在控制台手动调用测试

---

## 完成记录（Cursor 填写）

- 做了什么：
- 新增/修改文件：
- 截图或说明：
- 遗留问题 / 需要 Claude 修改的地方：

## 审阅意见（Claude 填写）
