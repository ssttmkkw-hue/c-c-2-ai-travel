# T04 · 服装系统 + 当地服装

- **状态**：todo
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
3. 衣柜 UI `src/ui/wardrobe/`：按 **B** 键打开/关闭，按地图卡分组显示服装卡片（名字 + 色块预览），点击即换装
   - 打开/关闭时发 `bus.emit('ui:modal', { id: 'wardrobe', open })`（会自动冻结玩家并释放鼠标）
4. 换装：`bus.emit('outfit:equip', { outfitId })`（Player 已监听）
5. 暂时所有服装都可用（解锁逻辑等存档系统，Claude 负责）

## 验收清单

- [ ] `npm run build` 通过
- [ ] B 打开衣柜，换每一套都正确显示，配件不重复叠加
- [ ] 配件在走路/跳跃时跟随头部

---

## 完成记录（Cursor 填写）

- 做了什么：
- 新增/修改文件：
- 截图或说明：
- 遗留问题 / 需要 Claude 修改的地方：

## 审阅意见（Claude 填写）
