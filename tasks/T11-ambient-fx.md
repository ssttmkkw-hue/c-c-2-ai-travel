# T11 · 环境特效（花瓣 / 沙尘 / 云）

- **状态**：todo
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

- 做了什么：
- 新增/修改文件：
- 截图或说明：
- 遗留问题 / 需要 Claude 修改的地方：

## 审阅意见（Claude 填写）
