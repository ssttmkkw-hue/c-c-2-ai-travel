# T01 · 通用道具库

- **状态**：done
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

- [x] `npm run build` 通过
- [x] 按数字键进入 gallery 地图，所有道具可见、比例与玩家（1.2m）协调
- [x] 像素大小 4 下，每种道具轮廓都能一眼认出
- [x] 符合面数限制（单道具 ≤ 15 部件，建筑 ≤ 40）
- [x] 道具代码中没有写死的场景颜色

## 不要做

- 不要做地标级建筑（鸟居、金字塔、铁塔放到各自地图卡里）
- 不要修改 kit.ts；需要新的基础形状（如三棱柱屋顶）在完成记录里提出

---

## 完成记录（Cursor 填写）

- 做了什么：通用道具工厂（植物 / 街道 / 自然 / 建筑，各 3 个 variant），固有色补了浅木、树皮、浅石、深金属。gallery 地图把四类道具分行排开（树 z=18、街道 z=8、自然 z=-1、建筑 z=-8，间距 4.2 / 3.4 / 2.6 / 8 m）。出生点 (0, 32) 朝 -Z，雾近平面 40m 内能看到最后一排。`npm run build` 零错误。本环境没有浏览器，像素大小 4 的目视项未勾。
- 新增/修改文件：`src/art/props/{trees,street,nature,buildings,index}.ts`、`src/art/props/README.md`、`src/art/colors.ts`、`src/maps/gallery/{index,palette}.ts`、`src/world/registry.ts`（末尾 import + 数组项）、`tasks/T01-props-library.md`、`tasks/README.md`
- 部件数（均 ≤15，建筑 ≤40）：
  - roundCrownTree 2~3、pineTree 4、sakuraTree 3、palmTree 6、bush 2~3
  - streetLamp 4、bench 4、trashBin 3、vendingMachine 5、postbox 3、trafficCone 2、fenceSegment 4
  - rock 2~3、grassTuft 3、flowerPatch 4
  - house ≤13（墙+门+每层 2 窗+屋顶 1~2+variant 2 烟囱）、shopfront 6、tower 6~11（楼身+顶+天线+每层 1 条窗带，层数 3~8）
- 截图或说明：按数字键 **3** 进入道具馆（注册顺序 tokyo、egypt、gallery）。人字顶用两块斜板拼，没有改 kit。
- 遗留问题 / 需要 Claude 修改的地方：若要更干净的人字顶，可在 kit 加三棱柱（底面三角、沿宽度挤出）。当前斜板在屋脊处会交叉重叠。目视验收已由 Code Bot 用 headless Chromium（swiftshader）在像素大小 4 下截图确认：gallery 按 3 可进入、道具全部可见、比例与玩家协调、控制台零报错。另注：gallery 调色板 accent 是红/黄，所以这里的樱花树不是粉色（樱花色取 p.accent，东京调色板下才是粉色），请 Claude 判断是否需要专门的花色。
- 第 1 轮审阅修改：`house` 人字顶改为 `kit.prism`（宽深各出檐 0.6m，即每边约 0.3m，底面在墙顶 `y = h`），去掉两块斜板；`COLORS.sakura` 增加 `#ffc4d8` / `#ff9fbf`，`sakuraTree` 改用该固有色；`buildings.ts` 顶部注释改为门朝 +Z。`npm run build` 零错误。
  - Code Bot headless 验证：人字顶为单个 prism、无重叠；gallery 中樱花为粉色；控制台零报错；截图 t01fix-*.png。

## 审阅意见（Claude 填写）

**第 1 轮（2026-11-18）· 小修后通过**

整体质量不错：结构清晰，variant 用法正确，没有 Math.random，部件数达标，颜色基本都从调色板 / 固有色取。展示地图很好用。

Claude 已处理：
- 建筑侧面噪点：是阴影贴图精度不够引起的阴影瑕疵，跟道具无关，已在 World.ts 里修复
- 新增 `kit.prism(w, h, d, color, opts)` 三棱柱：屋脊沿 X，底边沿 Z，`y` 是屋顶中心高度
- 朝向约定改为：**道具和建筑的正面朝 +Z**（这样用 `lookAt` 摆放更方便）。你的代码本来就是 +Z，不用改，只是 buildings.ts 顶部注释写成了“门朝 -Z”
- gallery 加了 `devOnly: true`，country 改成「开发用」，护照里不再显示它

请修改：
1. `house()` 的人字顶改用 `kit.prism`，去掉两块斜板。屋顶比墙每边宽出约 0.3m（出檐），底面贴在墙顶
2. 樱花树的花色不要取 `p.accent`（换了调色板就不是粉色了）。在 `COLORS` 加 `sakura: ['#ffc4d8', '#ff9fbf']` 之类的固有色，sakuraTree 用它（樱花本来就是粉色，算固有色）
3. 把 buildings.ts 顶部注释“门朝 -Z”改成“门朝 +Z”

改完直接把状态改为 `done`，不需要再审。
