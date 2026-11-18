# 道具库 `src/art/props/`（🎨 Cursor 工作区）

可复用的场景道具。每个道具一个工厂函数，接收调色板（或颜色）返回 `THREE.Group`。

```ts
// src/art/props/trees.ts
export function sakuraTree(p: Palette, variant = 0): THREE.Group
```

约定：
- 文件按类别分：`trees.ts` `street.ts`（路灯/长椅/自动售货机/邮筒）`buildings.ts` `nature.ts`（石头/草丛）…
- 统一从 `src/art/props/index.ts` 导出
- 原点在底部中心，朝向 -Z 为“正面”
- 函数注释写上：尺寸（米）、大约三角面数、适合哪些地图
- 有 `variant` 参数时用它产生小变化（高度、颜色索引），不要在道具内部用 Math.random（布局随机性用地图的 `ctx.rand`）
- 每做完一批道具，更新下面的清单

## 清单

| 函数 | 文件 | 尺寸 | 说明 |
|---|---|---|---|
| _（待 T01 填写）_ | | | |
