# T06 · 设置面板 + 正式 HUD

- **状态**：done
- **类型**：🖥 UI
- **依赖**：—
- **预估规模**：S

## 目标

用正式 UI 替换 `src/ui/debugHud.ts` 的调试文字。

## 必读

- src/core/settings.ts、src/core/events.ts、src/ui/debugHud.ts

## 允许修改的文件

- `src/ui/hud/**`、`src/ui/settings/**`（新建）、`src/ui/debugHud.ts`、`src/main.ts`

## 要求

1. **HUD**：左上角当前地点（“📍 东京 · 日本”，切换时有淡入动画）；右下角小字操作提示（几秒后自动淡出，按 H 重新显示）；“按 E 交谈”提示（监听 `npc:nearby`）在屏幕中下方
2. **设置面板**（按 Esc 后点击齿轮按钮，或按 P 打开）：
   - 像素大小滑块 1~8（实时生效）
   - 描边开关
   - 鼠标灵敏度滑块 0.3~2
   - 全部通过 `updateSettings()` 修改
   - 面板开关时发 `bus.emit('ui:modal', { id: 'settings', open })`
3. debugHud 精简为只保留开发快捷键（数字键切图、`[` `]`、O），不再显示文字；`setOutlineVisible` 逻辑保留
4. 风格与 T05 护照一致（如果 T05 尚未完成，先用 base.css 的变量，后续统一）

## 验收清单

- [x] `npm run build` 通过
- [x] 设置改完刷新页面仍然保留
- [x] 打开设置面板时游戏不响应 WASD

---

## 完成记录（Cursor 填写）

- 做了什么：正式 HUD（左上地点淡入、右下操作提示数秒后淡出、H 再显示、中下「按 E 交谈」）+ 设置面板（Esc 露出齿轮再点击，或 P 打开）。像素 1~8、描边、灵敏度 0.3~2 走 `updateSettings`，开关发 `ui:modal` id `settings`。护照打开时 P 被吃掉；设置打开时 Esc/P 只关设置。debugHud 只留数字键 / `[` `]` / O 和描边同步。
- 新增/修改文件：`src/ui/hud/**`、`src/ui/settings/**`、`src/ui/debugHud.ts`、`src/main.ts`（挂载 HUD 与设置）、本卡、`tasks/README.md`
- 截图或说明：风格对齐护照（纸色、4px 硬边、Fusion Pixel）。设置持久化沿用 `localStorage` 键 `ai-travel:settings`。本环境没有浏览器工具，未做点击走查；`npm run build` 已通过。
- 遗留问题 / 需要 Claude 修改的地方：无。`[` `]` 仍可把像素调到 1~10（开发快捷键原范围），面板滑块只写 1~8。
- 修复：开局护照先挂载时 `ui:modal` 会丢。现改为先挂 HUD/设置再挂护照，并在两者里于挂载后和下一微任务根据 `.passport` / `.settings` 是否隐藏补齐初始 modal，不依赖挂载顺序。护照打开时 P 不打开设置，Esc 只合护照、不切换齿轮。
- Code Bot headless 验证（截图 /workspace/c-c-2-shots/t06-*.png，在 Code Bot 机器上）：P 开设置、护照打开时 P 无效、Esc 关设置不影响护照、像素/描边/灵敏度写入 localStorage 且刷新后保留、设置打开时 WASD 不动、Esc 露出齿轮且点击可开设置、靠近小樱出现「按 E 交谈」、切图后地名更新，控制台零报错。第一轮发现“开局护照打开时 P 也能打开设置”（挂载顺序导致丢失初始 ui:modal），已修。
- 请 Claude 看：hud/settings 为补初始状态会在微任务里查询 `.passport` 的 DOM，是对护照类名的隐式耦合；可考虑在 bus 上加查询或让 ui:modal 状态可读。滑块是浏览器原生 range（圆形滑块），不完全像素风。

## 审阅意见（Claude 填写）

**第 1 轮（2026-11-18）· 通过 ✅**

实测：P 打开、角色冻结、滑块方向键调值、设置刷新后保留、Esc 关闭都正常。HUD 的地点淡入和提示自动变淡做得很好。

你提出的按键冲突问题是架构缺口，Claude 已在 `src/core/ui.ts` 加了弹窗栈和按键路由。迁移工作和像素风滑块一起放到了 **T12**。
