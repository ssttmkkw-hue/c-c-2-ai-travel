# T04 · 服装系统 + 当地服装

- **状态**：review
- **类型**：🎨 美术
- **依赖**：T03
- **预估规模**：M

## 目标

旅行收集要素：每张地图卡有当地服装，玩家可以在「衣柜」里换装。

## 必读

- src/avatar/types.ts（OutfitDef）、src/avatar/outfits.ts
- T03 完成后的 src/avatar/chibi.ts

## 允许修改的文件

- `src/avatar/outfits.ts`、`src/avatar/accessories.ts`（新建）
- `src/ui/wardrobe/**`（新建）、`src/main.ts`（挂载一行）

## 要求

1. 配件模型放 `src/avatar/accessories.ts`：斗笠、浴衣腰带、贝雷帽、条纹围巾、阿拉伯头巾、法老头饰（nemes）、草帽 —— 每个都是 kit 拼的小模型
2. 服装数据：
   - tokyo：浴衣（配色 + 腰带）、和风学生装
   - egypt：头巾旅人装、法老 cosplay
   - paris：条纹衫 + 贝雷帽
3. 衣柜 UI `src/ui/wardrobe/`：按 **B** 键打开/关闭（用 `keys.bind('game', 'KeyB', …)` 和 `keys.bind('wardrobe', ['KeyB', 'Escape'], …)`，见 `src/core/ui.ts`），按地图卡分组显示服装卡片（名字 + 色块预览），点击即换装
   - 打开/关闭时发 `bus.emit('ui:modal', { id: 'wardrobe', open })`（会自动冻结玩家并释放鼠标）
4. 换装：`bus.emit('outfit:equip', { outfitId })`（Player 已监听）
5. 暂时所有服装都可用（解锁逻辑等存档系统，Claude 负责）
6. 给东京的 3 个 NPC 分配不同服装（`NpcDef.outfit`），现在他们和玩家长得一模一样

## 验收清单

- [x] `npm run build` 通过
- [x] B 打开衣柜，换每一套都正确显示，配件不重复叠加
- [x] 配件在走路/跳跃时跟随头部

---

## 完成记录（Cursor 填写）

- 做了什么：
  - `accessories.ts` 用 kit 拼了斗笠、草帽、贝雷帽、条纹围巾、浴衣腰带、阿拉伯头巾、法老头饰（中脊用 `kit.prism`），另加水手领让学生装能认出来。草/木/黑头箍用 `COLORS`，布料色从服装定义传入。
  - 服装：旅行者、浴衣（赤带）、和风学生装、斗笠、草帽、头巾旅人装、法老戏装、条纹衫（贝雷帽 + 围巾 + 躯干色带）。都可直接穿。带造型头饰的套装不填 `colors.hat`，避免和 chibi 的扁帽叠在一起。
  - 衣柜：无弹窗时 `KeyB` 打开，衣柜在最上层时 `KeyB` / `Escape` 关闭，开关发 `ui:modal` id `wardrobe`。按随身 / 东京 / 埃及 / 巴黎分组（巴黎地图还没有，分组照样在），点击发 `outfit:equip`。风格对齐护照和设置（Fusion Pixel、硬边框、色块预览）。
  - 东京 NPC 只改了 `outfit`：小樱 `tokyo-student`、面店老板 `tokyo-yukata`、游客 `tokyo-straw`，三套互不相同，也都不是默认旅行者。
- 新增/修改文件：
  - 新增 `src/avatar/accessories.ts`、`src/ui/wardrobe/index.ts`、`src/ui/wardrobe/wardrobe.css`
  - 修改 `src/avatar/outfits.ts`、`src/main.ts`（import + `mountWardrobe(ui)`）、`src/maps/tokyo/index.ts`（仅三个 `npcs[].outfit`）、本卡与 `tasks/README.md`
- 截图或说明：
  - `npm run build` 通过。
  - 无头 Chrome 里合上护照后按 B 打开衣柜，四个分组和 8 张卡都在；点每套后头上配件节点始终是 0 或 1，来回切换不会叠两层。B 与 Esc 都会关掉，打开时 `player.inputBlocked` 为 true。
  - 第三人称近看：浴衣正面是赤带金线、背面有结；斗笠、草帽扣在头上；头巾两侧下垂；法老两侧垂带加额饰；学生装白领红结；条纹衫是蓝白横条、贝雷帽和两条围巾尾巴。跳跃时斗笠世界坐标跟着 head 一起变。
- 遗留问题 / 需要 Claude 修改的地方：
  - 没改 `chibi.ts`。上衣只有一种材质，条纹衫的横条是盖在躯干上的配件（比描边壳更宽，否则会被吃掉）。腰带、水手领同样挂在 head 上、用负 Y 落到身上。
  - 斗笠、草帽多做了两套东京装：三名 NPC 都要和默认装不同，这两顶帽子也要能单独换上。
  - 解锁仍等存档系统，现在全部可穿。
- Code Bot headless 验证（截图 r2-t04-*.png，正面合集 r2-t04-outfits-grid.png）：B 打开衣柜（top=wardrobe，WASD 冻结），B / Esc 关闭；8 套逐一点击（每套点两次）后 head 上 accessory 节点始终为 0 或 1，不叠加；跑步/跳跃时配件随头/上身一起动；东京 3 个 NPC 分别是学生装 / 浴衣 / 草帽，与玩家默认不同；控制台零报错。
- 请 Claude 看：① 为了不改 chibi.ts，条纹、腰带、水手领这些“身上”的装饰挂在 head 节点下、用负的局部 y 落到身上，跑步前倾时跟着上身走，看起来正常，但长远看最好在 AvatarRig 加 torso 挂点；② 为满足“3 个 NPC 各不相同”额外加了斗笠、草帽两套东京服装（共 8 套）；③ 带造型头饰的套装不填 colors.hat，以免和自带扁帽重叠；④ 为分配 NPC 服装改了 src/maps/tokyo/index.ts 的 npcs[].outfit 三行（T04 允许文件列表里没写，但要求 6 需要）。

## 审阅意见（Claude 填写）
