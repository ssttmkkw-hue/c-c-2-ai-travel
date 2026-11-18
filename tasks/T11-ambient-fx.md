# T11 · 环境特效（花瓣 / 沙尘 / 云）

- **状态**：review
- **类型**：✨ 特效
- **依赖**：—
- **预估规模**：M

## 目标

给地图卡加“空气感”：飘落物、远景云。用 InstancedMesh 保证性能。

## 必读

- src/world/MapCard.ts（`ctx.onUpdate`、`ctx.add`）、src/render/toon.ts、docs/ARCHITECTURE.md 性能一节

## 允许修改的文件

- `src/fx/**`（新建）
- `src/maps/*/index.ts`（只加一两行调用特效）

## 要求

1. `src/fx/particles.ts`：`addFallingParticles(ctx, { count, color, area, speed, sway, size, shape: 'petal'|'dust'|'leaf'|'snow' })`
   - 一个 InstancedMesh，粒子在玩家周围一定范围内循环（不要在整张地图铺满）
   - 玩家位置用 `ctx.getPlayerPosition()`
2. `src/fx/clouds.ts`：`addClouds(ctx, { count, color, height })` 低模云（几个 ball 拼），缓慢漂移，不投射阴影
3. 应用：东京 → 樱花花瓣（粉）；吉萨 → 细沙尘（淡金，横向飘）；巴黎（若已存在）→ 落叶
4. 每张地图粒子 ≤ 400 个

## 验收清单

- [ ] `npm run build` 通过
- [ ] 60fps 无明显掉帧
- [ ] 切换地图后旧特效被清除（onUpdate 自动注销、InstancedMesh 随 root 移除）

---

## 完成记录（Cursor 填写）

- 做了什么（fable/upgrade 分支，画质升级第二轮顺带做的**轻量版**）：
  - `src/fx/particles.ts`：`addFallingParticles(ctx, { shape, count, color, area?, speed?, sway?, wind?, size? })`。
    一个 InstancedMesh（1 次 draw call），粒子在玩家周围的盒子里循环（默认 26×9×26m），出盒子从对面绕回；
    形状是压扁的小方块（走 `toonMaterial`，受光照和雾影响），不投影、不描边。上限 400 个
  - 应用：东京 → 樱花瓣 260（`foliage[0]`）；吉萨 → 沙尘 220（`primary[0]`，横向飘）；巴黎 → 落叶 90（`accent[1]`）
  - 画质「低」关闭、「中」减半（每帧读 `getSettings().quality`，切换立即生效）
  - 贴着镜头的粒子会缩小到 0（离相机 0.8~1.6m 渐变），不会出现一大块色块挡镜头
- 新增/修改文件：`src/fx/particles.ts`（新）；`src/maps/{tokyo,egypt,paris}/index.ts` 各加一行调用
- 和任务卡的差异：
  - 参数多了 `wind`（沙尘横向飘要用），`area` 是 `[宽, 高, 深]`
  - **`src/fx/clouds.ts` 没做**（远景云）。天空现在是渐变穹顶（`src/render/sky.ts`），云留给后续
- 截图或说明：`/workspace/c-c-2-shots/fable-r2-*.png`
- 遗留问题 / 需要 Claude 修改的地方：
  - 验收清单里的「60fps 无明显掉帧」没法在这台机器上验证（无 GPU，软件渲染）。粒子本身每帧只是 ≤400 次矩阵合成 + 1 次 draw call
  - 粒子用 `mesh.onBeforeRender` 只读地记了一下相机位置（做近处淡出），因为 `MapBuildContext` 里没有相机；如果想更干净，可以给 ctx 加 `getCameraPosition()`
  - 粒子是 `kit.dynamic` 语义（`markDynamic`），不参与静态合批

## 审阅意见（Claude 填写）
