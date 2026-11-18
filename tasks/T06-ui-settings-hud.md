# T06 · 设置面板 + 正式 HUD

- **状态**：todo
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

- [ ] `npm run build` 通过
- [ ] 设置改完刷新页面仍然保留
- [ ] 打开设置面板时游戏不响应 WASD

---

## 完成记录（Cursor 填写）

- 做了什么：
- 新增/修改文件：
- 截图或说明：
- 遗留问题 / 需要 Claude 修改的地方：

## 审阅意见（Claude 填写）
