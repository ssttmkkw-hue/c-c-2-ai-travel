# T01 · 通用道具库

- **状态**：todo
- **类型**：🎨 美术
- **依赖**：—
- **预估规模**：L

## 目标

建立可复用的低模道具库，后续所有地图卡都从这里取材，保证风格统一、减少重复劳动。

## 必读

- AGENTS.md、docs/ART_GUIDE.md（尤其是尺寸、面数、颜色三节）
- src/art/kit.ts、src/art/colors.ts、src/art/props/README.md
- src/maps/tokyo/index.ts（看现有占位怎么拼的）

## 允许修改的文件

- `src/art/props/**`（新建）
- `src/art/colors.ts`（增补固有色）
- 新建 `src/maps/gallery/` 道具展示地图（见要求 3），并在 registry.ts 注册到**数组末尾**

## 要求

1. 每个道具是工厂函数 `(p: Palette, variant?: number) => THREE.Group`，统一从 `src/art/props/index.ts` 导出
2. 至少实现以下道具（每个 2~3 个 variant）：
   - **植物** `trees.ts`：圆冠树、锥形松树、樱花树、棕榈树、灌木丛
   - **街道** `street.ts`：路灯、长椅、垃圾桶、自动售货机、邮筒、交通锥、栅栏段（长度参数）
   - **自然** `nature.ts`：石头（3 种大小）、草丛、花丛
   - **建筑** `buildings.ts`：
     - `house(p, {w, d, floors, roof: 'gable'|'flat'|'hip'})` 通用房子，带门窗（窗户用 accent/glass 色的薄片，不描边）
     - `shopfront(p, {w, signColor})` 带招牌和遮阳棚的一层店铺
     - `tower(p, {floors})` 细高楼（城市背景用）
3. 建一张 **道具展示地图** `gallery`（调色板用 _template 的），把所有道具按网格排开、每类一行，方便目视检查
4. 填写 `src/art/props/README.md` 的清单表
5. 道具里不要用 `Math.random()`，变化由 variant 决定

## 验收清单

- [ ] `npm run build` 通过
- [ ] 按数字键进入 gallery 地图，所有道具可见、比例与玩家（1.2m）协调
- [ ] 像素大小 4 下，每种道具轮廓都能一眼认出
- [ ] 符合面数限制（单道具 ≤ 15 部件，建筑 ≤ 40）
- [ ] 道具代码中没有写死的场景颜色

## 不要做

- 不要做地标级建筑（鸟居、金字塔、铁塔放到各自地图卡里）
- 不要修改 kit.ts；需要新的基础形状（如三棱柱屋顶）在完成记录里提出

---

## 完成记录（Cursor 填写）

- 做了什么：
- 新增/修改文件：
- 截图或说明：
- 遗留问题 / 需要 Claude 修改的地方：

## 审阅意见（Claude 填写）
