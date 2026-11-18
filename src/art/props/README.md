# 道具库 `src/art/props/`（🎨 Cursor 工作区）

可复用的场景道具。每个道具一个工厂函数，接收调色板（或颜色）返回 `THREE.Group`。

```ts
// src/art/props/trees.ts
export function sakuraTree(p: Palette, variant = 0): THREE.Group
```

约定：
- 文件按类别分：`trees.ts` `street.ts`（路灯/长椅/自动售货机/邮筒）`buildings.ts` `nature.ts`（石头/草丛）…
- 统一从 `src/art/props/index.ts` 导出
- 原点在底部中心，**正面（门/窗/招牌）朝 +Z**。摆放时可用 `obj.lookAt(x, 0, z)` 让正面对着某点
- 函数注释写上：尺寸（米）、大约三角面数、适合哪些地图
- 有 `variant` 参数时用它产生小变化（高度、颜色索引），不要在道具内部用 Math.random（布局随机性用地图的 `ctx.rand`）
- 每做完一批道具，更新下面的清单

## 清单

| 函数 | 文件 | 尺寸 | 说明 |
|---|---|---|---|
| `roundCrownTree(p, variant?)` | trees.ts | 高 3.2~4.6 | 圆冠，部件 2~3 |
| `pineTree(p, variant?)` | trees.ts | 高 4.2~5.4 | 三层锥冠，部件 4 |
| `sakuraTree(p, variant?)` | trees.ts | 高 3.4~4.2 | 花色取 COLORS.sakura，部件 3 |
| `palmTree(p, variant?)` | trees.ts | 高 4~5.5 | 五片叶，部件 6 |
| `bush(p, variant?)` | trees.ts | 高 0.7~1.1 | 灌木，部件 2~3 |
| `streetLamp(p, variant?)` | street.ts | 高 3.2~4.2 | 路灯，部件 4 |
| `bench(p, variant?)` | street.ts | 1.6×0.9×0.5 | 长椅，部件 4 |
| `trashBin(p, variant?)` | street.ts | 高约 1 | 垃圾桶，部件 3 |
| `vendingMachine(p, variant?)` | street.ts | 1×1.9×0.7 | 售货机，部件 5 |
| `postbox(p, variant?)` | street.ts | 高约 1.15 | 邮筒，部件 3 |
| `trafficCone(p, variant?)` | street.ts | 高约 0.7 | 交通锥，部件 2 |
| `fenceSegment(p, length?, variant?)` | street.ts | 长默认 2，高 1 | 栅栏段，部件 4 |
| `rock(p, variant?)` | nature.ts | 0.4 / 0.8 / 1.4 | variant 对应小中大，部件 2~3 |
| `grassTuft(p, variant?)` | nature.ts | 高约 0.45 | 草丛，部件 3 |
| `flowerPatch(p, variant?)` | nature.ts | 宽约 0.8 | 花丛，部件 4 |
| `house(p, {w,d,floors,roof}, variant?)` | buildings.ts | 默认 6×5，层高 2.4 | roof: gable/flat/hip，部件 ≤11 |
| `shopfront(p, {w, signColor}, variant?)` | buildings.ts | 默认宽 5，高 3.2 | 招牌+遮阳棚，部件 6 |
| `tower(p, {floors}, variant?)` | buildings.ts | 宽 3.2，3~8 层 | 窗带代替单窗，部件 ≤11 |

variant 取 0~2 循环。场景色只用调色板；木、石、金属、玻璃来自 `colors.ts`。
