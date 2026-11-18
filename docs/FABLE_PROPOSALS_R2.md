# Fable 提案 R2（fable/upgrade，基于 `0743702`）

> 写给 kk 和接手实装的 cursor-agent（Grok）。
> 第 1 节给 kk 扫一眼；第 2 节是红线；第 3 节每一项都写到「不用再问就能动手」；第 5 节是可以直接贴给实装代理的话。
> 本文只提**新的**事项。`docs/UPGRADE_PLAN.md` §4 和 `docs/CLAUDE_REVIEW_UPGRADE_R1.md`「本轮优先事项」里已有的条目，这里只在能补充具体做法时用「引用编号 + 补充」的方式出现。
> 截图路径都在 `/workspace/c-c-2-shots/`（不进仓库）。本文的判断来自读代码和看这些截图，**这一轮我没有运行游戏**，凡是推断都标了「推断」。

## 1. 摘要

**一句话：** 上两轮把「糊」和「卡」处理了，现在的短板换成了「镜头会钻墙、世界不理人、没有声音、边界像纸板」。这一轮建议把额度花在玩家一上手就能感觉到的地方，而且绝大部分不需要等真机数据。

### 现在还差在哪

| 方面 | 现状（代码或截图里看到的） |
|---|---|
| 镜头 | `CameraRig.update` 直接把相机放到角色身后 6 米，不看有没有墙。霓虹街只有 4.2 米宽，一转身相机就在店里。角色永远在画面正中，正好挡住地标（`fable-p1-water-tokyo-sky.png` 里头挡着鸟居）。 |
| 移动 | `Player.update` 的速度是瞬间到位、瞬间停下；顶着墙跑时动画照样全速摆腿。 |
| NPC | `spawnNpcs` 只调 `rig.animate(dt, 0, false)`：不看玩家、不转身，而且所有 NPC 的呼吸从同一个相位开始，整齐划一。对话时镜头不动，`ui1080-dialogue.png` 里说话的 NPC 根本不在画面里。 |
| 对话 | 对话框没有绑定 Esc，四句台词必须按八次 E 才能走开。 |
| 声音 | 整个仓库没有任何音频代码。 |
| 目标感 | 除了走路和交谈没有别的事可做。导游 NPC 的 `guide.topics` 里已经列了每张图的景点，但游戏里没有任何地方用到。 |
| 画面 | 云是横跨半个屏幕的直边白色碎片（`fable-p1-water-tokyo-sky.png`）；三张图的边界都是一整块平板墙（`fable-p1-water-egypt.png` 的棕色岩壁、`r3-t09-eiffel.png` 铁塔背后的米色墙）；细杆的影子断成虚线（`fable-p1-paris-1280.png` 路灯影子）；花瓣有一半是暗红色小方块。 |
| 性能 | 每个角色约 25 次绘制，但站着不动的 NPC 四肢根本不转。这部分不用等蒙皮就能省掉。 |
| 真机测试 | kk 在手机上没有任何办法读到帧率：`__game` 只在开发模式存在，正式构建里没有帧率显示。 |

### 建议先做的（都不依赖真机）

1. **A1 真机诊断面板**：让 kk 在任何设备上点一下就得到一份可以粘贴回来的帧率报告。这是 P0-1 一直卡着的原因之一。
2. **A2 镜头不钻墙**、**A3 三个小缺陷**（对话 Esc、两处资源没释放）。
3. **B2 站立 NPC 整体合批**：每个 NPC 从约 25 次绘制降到约 7 次，全场约少 40%，不需要蒙皮。
4. **B1 移动手感**、**B3 NPC 看向玩家**、**B4 对话镜头**：手感三件套。
5. **B5 云重画**、**B6 边界天际线**、**B7 画面瑕疵包**：一眼能看出的画面改进。
6. **B9 景点打卡**、**B10 程序合成音效**：给游戏加上「目标」和「声音」。

### 必须等真机的（本文不建议现在动）

- 默认画质档位、默认 `pixelDensity`。
- 像素风中 / 高档是否从 `PCFSoftShadowMap` 换成硬采样（R1 性能一节第 3 条）。
- 粒子是否搬进顶点着色器（现在每帧在 CPU 上给每个粒子算矩阵）。
- 蒙皮是否值得做。B2 做完后，角色开销只剩玩家自己和将来会走动的 NPC，这个问题的答案可能会变。

A1 做完之后，这些问题都可以用 kk 贴回来的一段 JSON 回答。

---

## 2. 不要破坏的东西

沿用 `docs/CLAUDE_REVIEW_UPGRADE_R1.md`「不要破坏的东西」全部七条：整数倍放大、`visual-check` 基线、three 固定 0.170.0、自动降档契约、`kit.dynamic` / 合批契约、总线通信、无密钥 / 无外部贴图或 glTF / 无新依赖、只在 `fable/upgrade` 上工作。下面是本轮新增的。

### 2.1 「冻结帧」契约（最容易踩）

`tools/visual-check.mjs` 用 `engine.freezeVisual(1.5)` 让 `dt = 0`，然后用 `Object.assign(g.player.cam, { yaw, distance, pitch, mode })` 直接写相机字段，等 3 帧截图。所以：

- `CameraRig` 的 `yaw` / `pitch` / `distance` / `mode` 必须一直是**可以直接赋值、下一帧立刻生效**的公开字段。
- 本轮新增的所有缓动（镜头、NPC 转头、落地挤压、入场镜头）在 `dt === 0` 时必须**直接取目标值或保持不动**，不能卡在半路，也不能把脚本刚写进去的值改回去。
- 所有新增的随机相位必须是确定的（按序号或坐标算），不能用 `Math.random()` 影响画面，否则基线每次都不一样。
- `visual-check` 会把 `#ui` 设为 `visibility: hidden`，所以**纯 UI 的改动不会被基线覆盖**，要单独截图验收。

### 2.2 `AvatarRig` 的分工

`src/avatar/types.ts` 的契约不改。本轮约定：

- `animate()` 只写 `head.rotation.x` / `head.rotation.z`；**`head.rotation.y` 留给外部**（NPC 看向玩家）。
- `rig.root.position.y` 留给外部（NPC 打招呼的小跳）；`hips.position.y` 归 `animate()`。
- `createAvatar(outfitId, { idle: true })` 得到的「站立版」四肢不会动，只能用于永远站着的 NPC。

### 2.3 保留区改动的授权方式

本文有若干项要改 `AGENTS.md` 里的 🔒 保留区。约定和 R1 一样：

- **kk 把本文交给实装代理，即视为授权每一项「要改的文件」里点名的那些文件和符号，不多不少。**
- 每次提交的完成记录里单列「保留区改动」，写清改了哪个符号、为什么，留给 Claude 复审。
- 不在清单里的保留区文件不要动；需要时写「需要 Claude 修改：…」并停下。

本轮涉及的保留区文件：`src/core/events.ts`（只加事件类型）、`src/core/settings.ts`（B10 加一个音量字段）、`src/player/CameraRig.ts`、`src/player/Player.ts`、`src/world/World.ts`（A3 的 `unload`）、`src/render/sky.ts`（B5）、`src/npc/spawn.ts`（B2 / B3 各一行）、`src/main.ts`（挂载行）、`tools/visual-check.mjs`（加视角）。

### 2.4 不要抢 Claude 的保留任务

`tasks/README.md` 列的这些仍归 Claude：AI 导游接入、**存档系统（旅行记录、已收集服装、护照印章）**、后期管线（量化 / 抖动 / 边缘检测）、碰撞升级、泛光。本文的 B9（打卡）只做**本次会话内**的内存状态并留好读取口子，不写 `localStorage`；C3（灯下光斑）是不用后期的替代品，不是泛光。

### 2.5 其他

- **绘制次数预算。** 以当前 1280×800 出生点的约 124 / 83 / 121（东京 / 吉萨 / 巴黎）为基准，B2 之后应明显下降；其余每一项新增不超过 +3，并在完成记录里写出实测值。
- **每帧不分配。** 新写的每帧逻辑不要 `new Vector3()`，用模块级或成员级的临时变量（顺手把 `Player.update` 和 `CameraRig.update` 里现有的两处也改掉，对应 R1 第 9 项）。
- **不要动相机 `fov`。** `setOutlineWidth(view.outlinePx, view.height, camera.fov)` 只在 `Engine.resize` 里调用，运行中改 fov 会让描边粗细不对；竖屏 fov 归 R1 第 4 项处理。
- **音频不带素材文件。** B10 全部用 WebAudio 现场合成。
- **和 R1 那条线的合并。** R1 第 2–7 项可能正在另一条线上改 `Input.ts`、`Engine.ts`、`CameraRig.ts`、`chibi.ts`、`spawn.ts`、`World.ts`。每做一项之前先 `git pull --rebase`；第 3 节每项的「依赖」里写了和哪一项撞文件。

---

## 3. 优先事项清单

编号：A = P0，B = P1，C = P2。工作量按一个熟悉本项目的人估算。「shots」指 `npm run shots`（需要开发服务器在 5173 端口）。

需要重截基线的项目统一规则：在**那一次提交**里跑 `node tools/visual-check.mjs --update`，并把改前改后的截图存到 `/workspace/c-c-2-shots/r2-<编号>-{before,after}-<地图>.png`（不进仓库），完成记录里写明基线变了什么。

### 新增事件汇总（都加在 `src/core/events.ts` 的 `GameEvents` 里）

```ts
/** 每秒一次的性能采样（A1），由只读的探针发出 */
'perf:sample': { fps: number; worstMs: number; calls: number; triangles: number; gpu: string };
/** 玩家起跳 / 落地（B1）。speed = 落地瞬间的下落速度（米/秒） */
'player:jump': Record<string, never>;
'player:land': { speed: number };
/** 对话框每显示两个字发一次（B4），给音效用 */
'dialogue:tick': Record<string, never>;
/** 到访一个景点（B9）。visited / total 是当前地图的进度 */
'poi:visit': { mapId: string; id: string; name: string; blurb: string; visited: number; total: number };
```

哪一项用到就在哪一项的提交里加，不要一次全加。

---

## P0

### A1 · 真机诊断面板

**收益：** kk 在手机或任何电脑上打开一个链接、点一下，就得到一段可以粘贴回来的帧率报告。P0-1 不再需要开发者工具。

**为什么现在做**

- `src/main.ts` 里 `__game` 和 `qualityReport()` 只在 `import.meta.env.DEV` 下存在，正式构建没有任何帧率显示。
- `src/ui/settings/index.ts` 的齿轮按钮初始 `gear.hidden = true`，只有按 Esc 才出现；手机上在 R1 第 2 项落地之前连设置都打不开。所以入口必须是**地址栏参数**。
- R1 第 7 项的 `tools/perf.mjs` 是无头环境用的，解决不了「kk 手里那台机器」的问题。

**要改的文件**

- 新建 `src/fx/perfProbe.ts`（只读访问 Engine 的表现层，和 `fx/particles.ts` 同一类）
- 新建 `src/ui/diag/index.ts`、`src/ui/diag/diag.css`
- `src/core/events.ts`：加 `'perf:sample'`
- `src/main.ts`：加两行挂载
- `src/ui/settings/index.ts`：面板底部加一个「性能信息」按钮

**具体做法**

1. `perfProbe.ts` 导出 `mountPerfProbe(engine: Engine): void`。
   - 用 `engine.onUpdate` 每帧记一次 `performance.now()` 的间隔，存进一个预分配的 `Float32Array(240)` 环形缓冲。
   - 大于 1000 毫秒的间隔丢弃（切后台），和 `src/ui/autoQuality.ts` 的 `MAX_GAP_MS` 同一口径。
   - 累计满 1000 毫秒发一次 `bus.emit('perf:sample', …)`：`fps = 1000 / 中位数间隔`，`worstMs` = 95 分位间隔，`calls` / `triangles` 读 `engine.renderer.info.render`。
   - `gpu`：`const gl = engine.renderer.getContext(); const ext = gl.getExtension('WEBGL_debug_renderer_info'); ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : '未知'`，只取一次。
   - 注意口径：`Engine.renderFrame` 里 `info.autoReset` 的用法决定了 `calls` = 主场景一遍 + 1 次 blit，**不含阴影遍**。面板上照实标注。
2. `ui/diag`：导出 `mountDiag(root: HTMLElement): void`。只通过 `bus` 取数据（`perf:sample`、`render:view`、`settings:changed`、`map:loaded`），不 import Engine。
   - 默认隐藏。地址栏带 `?diag=1` 时直接显示；设置面板里的「性能信息」按钮也能开关（按钮发一个 DOM 自定义事件或直接调用 `mountDiag` 返回的 `toggle()`，由 `main.ts` 传给 `mountSettings` 不合适，建议 `diag/index.ts` 导出模块级的 `toggleDiag()`，`settings` 直接 import）。
   - 面板放左下角，不是弹窗（不发 `ui:modal`，不挡操作），`pointer-events` 只开在按钮上。
   - 显示：帧率 / 最差帧间隔、内部分辨率和放大倍数、画面风格 / 颗粒 / 画质、绘制次数和三角形（注明「不含阴影遍」）、显卡名、`devicePixelRatio`。
   - 三个按钮：「跑一遍测试」「复制结果」「关闭」。
3. 「跑一遍测试」：对应 `UPGRADE_PLAN.md` P0-1 要的三种设置。
   - 开始时 `const snapshot = { ...getSettings() }`。
   - 依次应用 `{ renderMode: 'pixel', quality: 'high' }`、`{ renderMode: 'hd', quality: 'high' }`、`{ renderMode: 'pixel', quality: 'low' }`，**都用 `updateSettings(patch, 'auto')`**，这样不会写 `qualityManual`。
   - 每种设置等 1500 毫秒，再收 4 个 `perf:sample` 取中位数，同时记下当时的 `render:view`。
   - 结束后 `updateSettings(snapshot, 'auto')` 整体恢复（包括 `autoQualityDone`，以防自动降档在测试期间插了一脚）。
   - 首次 `map:loaded` 之后 6 秒内按钮禁用，避开自动降档的采样窗口。
4. 结果是一段 JSON，放进只读 `<textarea>`：`{ map, ua, dpr, screen: [w, h], gpu, rows: [{ preset, view: '640x400@2', fps, worstMs, calls, triangles }] }`。「复制结果」先试 `navigator.clipboard?.writeText`，失败就选中文本框让用户手动复制。
5. 面板文字用现有的 `--ui-*` 变量和 12px 点阵字，样式参考 `src/ui/autoQuality.css`。

**风险与回归**

- 帧率由 `requestAnimationFrame` 量，会被屏幕刷新率封顶；面板上写一行「顶到 60 / 120 说明还有余量」。
- 测试期间画面会切三次风格，属于预期。
- 不影响合批、描边、基线（UI 在截图时是隐藏的）。

**验收标准**

- `npm run typecheck`；`npm run shots` 零差异。
- Playwright 打开 `/?diag=1&autoquality=0`：面板可见，3 秒后帧率文本是正数。
- 点「跑一遍测试」，约 20 秒后文本框里的 JSON 有 3 行；`localStorage['ai-travel:settings']` 的内容和测试前逐字相同。
- `npm run build && npm run preview` 下同样可用（不依赖 `__game`）。
- 不带 `?diag=1` 时页面上没有这个面板的可见元素。

**工作量：** 3–4 小时。 **依赖：** 无。R1 第 2 项（触屏按钮）落地后，设置里的入口在手机上才点得到；在那之前用 `?diag=1`。

---

### A2 · 镜头不钻墙，跳跃时画面不跟着抖

**收益：** 在窄街和墙边转视角时，镜头不再钻进房子里；跳起来时画面更稳。

**为什么现在做**

- `src/player/CameraRig.ts` 第三人称分支：`camera.position.set(pivot + 方向 × this.distance)`，唯一的保护是 `camera.position.y = Math.max(camera.position.y, 0.3)`。完全不看 `world.colliders`。
- 东京霓虹街的路面是 `kit.box(30, 0.05, 4.2, …)`（`src/maps/tokyo/street.ts`），两侧店铺都开了 `collide: true`。相机距离默认 6 米，在街上横着看时相机一定在店里，画面是一整块墙的内侧。`/workspace/c-c-2-shots/r2-t02-neon-street.png` 只有顺着街拍才正常。
- pivot 直接取 `target.y + PIVOT_HEIGHT`，玩家跳 1 米，整个画面跟着上下跳 1 米。
- 这是下面 B4、C1、C2 的前置：它们都要在 `CameraRig` 上加东西，先把这次的结构定下来。

**要改的文件：** `src/player/CameraRig.ts`、`src/player/Player.ts`（都在保留区）。

**具体做法**

1. `CameraRig` 加一个公开字段 `obstacles: () => readonly THREE.Box3[] = () => []`。`Player` 构造函数里写 `this.cam.obstacles = () => this.world.colliders`。
2. `CameraRig` 加成员级临时变量：`pivot`、`dir`、`hit`（`THREE.Vector3`）、`ray`（`THREE.Ray`），以及状态 `effDistance = this.distance`、`pivotY = PIVOT_HEIGHT`。删掉现有的 `new THREE.Vector3(...)`。
3. `update` 开头保存 `const rawDt = dt;`，再走现有的 `if (frozen) dt = 0`。**缓动一律用 `rawDt`**，弹窗打开时镜头仍能平滑，`rawDt === 0`（冻结帧）时直接取目标值。
4. 第三人称分支改成：
   - `targetY = target.y + PIVOT_HEIGHT`；`pivotY = rawDt === 0 ? targetY : damp(pivotY, targetY, 10, rawDt)`。`damp` 用 `chibi.ts` 里同样的公式 `cur + (to - cur) * (1 - Math.exp(-λ·dt))`。
   - `dir = (sin(yaw)·cos(pitch), -sin(pitch), cos(yaw)·cos(pitch))`，这就是现有公式里从 pivot 指向相机的单位向量。
   - `let limit = this.distance;` 遍历 `this.obstacles()`，对每个盒子 `b`：
     - `b.max.y < 2.2` 跳过（NPC、石灯笼、栏杆、长椅不挡镜头）；
     - `Math.min(b.max.x - b.min.x, b.max.z - b.min.z) < 1.0` 跳过（树干、鸟居柱、电线杆。树干的碰撞盒只有 0.44 米宽，见 `src/maps/tokyo/index.ts` 的 `buildApproach`）；
     - `b.containsPoint(pivot)` 跳过；
     - `ray.set(pivot, dir)`，`if (ray.intersectBox(b, hit)) limit = Math.min(limit, pivot.distanceTo(hit) - 0.35)`。
   - `limit = Math.max(1.2, limit)`。
   - 拉近立刻生效、放远慢慢回：`effDistance = (limit < effDistance || rawDt === 0) ? limit : damp(effDistance, limit, 5, rawDt)`。
   - 相机位置 = `pivot + dir × effDistance`，保留 `Math.max(y, 0.3)`，`camera.lookAt(pivot)`。
5. `this.distance` 仍然是玩家用滚轮设的「想要的距离」，不被碰撞改写。
6. 第一人称分支不动。

**风险与回归**

- 金字塔的碰撞盒如果是整体包围盒，镜头会在金字塔的「空气角」处提前拉近。可以接受；如果观感差，在完成记录里写出来，不要为它改 `MapBuildContext`。
- R1 第 4 项（竖屏拉远距离）也改 `CameraRig`：竖屏倍率应乘在 `this.distance` 上，再进入第 4 步的碰撞裁剪。
- 基线三个视角相机后方都没有高于 2.2 米的盒子（东京相机在 z≈29.6，南侧房子从 z=33 开始；吉萨、巴黎同理），预期零差异。

**验收标准**

- `npm run typecheck`；`npm run shots` **零差异**。
- Playwright（开发模式）：`g.player.teleport(20, 6.6, 0)`，然后把 `g.player.cam.yaw` 依次设为 8 个方向各等 30 帧，每次检查
  `g.world.colliders.some(b => b.max.y >= 2.2 && Math.min(b.max.x - b.min.x, b.max.z - b.min.z) >= 1 && b.containsPoint(g.engine.camera.position)) === false`，且 `g.player.cam.distance === 6`。
- 站在空地上（`teleport(0, 22, 0)`）时 `camera.position` 到 pivot 的距离等于 6（误差 0.01）。
- 存一张霓虹街横向视角的改前改后截图。

**工作量：** 3 小时。 **依赖：** 无；和 R1 第 4 项撞 `CameraRig.ts`，谁后做谁 rebase。

---

### A3 · 小缺陷包（对话能退出，两处资源没释放）

**收益：** 对话可以随时按 Esc 走开；反复切地图和换装不再悄悄占内存。

**为什么现在做**

1. `src/ui/dialogue/DialogueBox.ts` 的 `dialogue` 作用域只绑了 `KeyE` / `Space` / `Enter` 和方向键，**没有 Escape**。`core/ui.ts` 在有弹窗时只路由最上层作用域，所以对话期间 Esc 没有任何效果。导游有四句台词，每句要按两次（补全 + 下一句）。
2. `src/world/World.ts` 的 `unload()` 只对 `geometry` 调 `dispose()`。
   - `InstancedMesh` 的 `instanceMatrix` / `instanceColor` 缓冲要靠 `mesh.dispose()` 才释放。每张图有 3 个地面细节（`art/props/ground.ts`）加 1 个粒子（`fx/particles.ts`）共 4 个实例化 mesh。
   - `kit.waterSurface` 每次建图都 `createWaterMaterial()` 一个新的 `ShaderMaterial`，卸载时没释放。
3. `src/avatar/chibi.ts` 的 `setOutfit` 用 `node.remove(child)` 摘掉旧配件，配件的几何体（`buildAccessory()` 每次新建）没有 `dispose`。

第 2、3 条是**读代码得出的推断**，量很小，但手机上切图多了会累积；验收里有确认步骤。

**要改的文件：** `src/ui/dialogue/DialogueBox.ts`、`src/world/World.ts`（保留区，只动 `unload`）、`src/avatar/chibi.ts`。

**具体做法**

1. `DialogueBox` 构造函数里加 `keys.bind('dialogue', 'Escape', () => { if (this.opened) this.close(); });`。`close()` 已经会 `session += 1`，`playLines` 里的 `isSession` 检查会让剩余台词作废。提示文字改成 `E / 空格 / 点击继续 · Esc 结束`（两处：模板和 `open()`）。
2. `World.unload()` 的 `traverse` 回调改成三步：
   - 现有的 `geo.dispose()` 保留；
   - `if ((o as THREE.InstancedMesh).isInstancedMesh) (o as THREE.InstancedMesh).dispose();`
   - `const mat = (o as THREE.Mesh).material; if (mat && !Array.isArray(mat) && (mat as THREE.ShaderMaterial).isShaderMaterial) mat.dispose();`
   - 卡通材质和描边材质是全局缓存的 `MeshToonMaterial` / `MeshBasicMaterial`，不满足 `isShaderMaterial`，不会被误释放。天空不在 `root` 下，不受影响。
3. `chibi.ts` 的 `setOutfit`：在 `node.remove(child)` 之前 `child.traverse((o) => (o as THREE.Mesh).geometry?.dispose())`。此时 `batch?.restore()` 已经把零件挂回原位，遍历得到。描边外壳和本体共用几何体，重复 `dispose` 无害。

**风险与回归：** 都是释放路径，画面不变。唯一要小心的是别释放缓存材质（见上）。

**验收标准**

- `npm run typecheck`；`npm run shots` 零差异。
- Playwright：`g.bus.emit('npc:interact', { npcId: 'tokyo-guide' })` → `g.dialogue.isOpen === true` → 按 Escape → `g.dialogue.isOpen === false`，随后按 W 玩家能移动。
- 东京 → 吉萨 → 巴黎循环 6 轮，每次回到东京记 `g.engine.renderer.info.memory.geometries` 和 `g.engine.renderer.info.programs.length`：各轮相等。
- 连续 `g.bus.emit('outfit:equip', …)` 在 8 套服装间切 20 次，`info.memory.geometries` 不增长。**先在改之前跑一遍这一条**，把增长量写进完成记录，确认推断成立；如果改前就不增长，说明推断错了，只保留第 1、2 步。
- 控制台 0 错误。

**工作量：** 1.5 小时。 **依赖：** 无；`World.ts` 和 R1 第 5、6 项撞文件，改动只在 `unload` 里。

---

## P1

### B1 · 移动手感：起步和停下有过渡，跳跃可控

**收益：** 走路不再是「瞬间到速、瞬间停住」；轻点空格是小跳、按住是大跳；顶着墙时角色不再原地全速摆腿。

**为什么现在做**

- `src/player/Player.ts`：`move.normalize().multiplyScalar(RUN 或 WALK)`，然后 `position.addScaledVector(move, dt)`。没有速度状态，按下即满速，松开即零。
- `this.avatar.animate(dt, move.length(), …)` 传的是**想要的**速度，不是实际速度。被墙挡住时 `resolveCollisions` 把位置推回去了，动画照跑。
- 跳跃只有 `velY = JUMP` 一种高度。落地前一瞬间按的空格会被吞掉（`wasPressed` 只在那一帧有效）。
- 没有起跳和落地事件，B10（音效）和 C4（尘土）没处挂。

**要改的文件：** `src/player/Player.ts`（保留区）、`src/core/events.ts`（加 `player:jump`、`player:land`）。

**具体做法**

1. 新成员：`vel = new THREE.Vector3()`（只用 x、z）、`wish = new THREE.Vector3()`、`jumpBuffer = 0`、`wasAir = false`。常量：`ACCEL = 45`、`DECEL = 38`、`AIR_ACCEL = 14`（米/秒²）、`JUMP_BUFFER = 0.12`（秒）、`JUMP_CUT = 1.4`。
2. 水平移动：
   - `wish` = 现有公式算出的方向 × 速度；没有输入或 `blocked` 时为零向量。
   - `rate = 在地面 ? (wish 非零 ? ACCEL : DECEL) : AIR_ACCEL`。
   - `vel` 朝 `wish` 靠近，每帧最多变 `rate × dt`（差向量长度不超过这个值就直接取 `wish`）。
   - `facing` 的更新条件和公式不变（有输入时朝 `wish` 的方向）。
   - 记下 `prevX` / `prevZ`，`position.addScaledVector(vel, dt)`，`resolveCollisions()`。
   - **碰撞之后**，`if (dt > 0) { vel.x = (p.x - prevX) / dt; vel.z = (p.z - prevZ) / dt; }`。这样撞墙后速度真的掉下来，沿墙滑动时保留切向速度。
3. 跳跃：
   - `if (!blocked && input.wasPressed('Space')) jumpBuffer = JUMP_BUFFER; else jumpBuffer -= dt;`
   - `if (onGround && jumpBuffer > 0) { velY = JUMP; jumpBuffer = 0; bus.emit('player:jump', {}); }`
   - 上升途中松开空格就多加一份重力：`if (velY > 0 && !down('Space')) velY -= GRAVITY * JUMP_CUT * dt;`
   - 地面是固定的 y=0，没有平台边缘，所以**不做**「土狼时间」。
4. 落地：本帧 `position.y === 0` 且 `wasAir` 为真时 `bus.emit('player:land', { speed: 落地前的 -velY })`。最后更新 `wasAir`。
5. `this.avatar.animate(dt, Math.hypot(vel.x, vel.z), this.position.y > 0.01)`。
6. `teleport()` 里把 `vel` 清零。
7. 顺手把 `new THREE.Vector3()` 改成成员变量。

手感目标：走路 4 米/秒约 0.09 秒到速、0.1 秒停住；跑步约 0.17 秒到速。键盘上是「细腻一点」，不是大变化；R1 第 2 项的摇杆接进来后（模拟量输入），这一步的作用会更明显。

**风险与回归**

- 加速度太低会「滑冰」。上面的数值是保守值，调的时候只许往大调。
- `Player.ts` 和 R1 第 2 项（触屏读输入）撞同一段代码。
- 基线里玩家静止，零差异。

**验收标准**

- `npm run typecheck`；`npm run shots` 零差异。
- Playwright：按住 `KeyW` 逐帧采样 `g.player.position`，第 1 帧的位移对应速度 < 4 米/秒，0.3 秒后稳定在 4（误差 0.1）；松开后至少还有 2 帧位移不为零，0.3 秒内停住。
- 贴墙站着按住朝墙的方向 1 秒，位置变化 < 0.05 米。
- 轻点空格（按下 30 毫秒）最高点 < 0.75 米；按住空格最高点在 1.0–1.1 米（`JUMP² / 2·GRAVITY ≈ 1.06`）。
- 监听到 `player:jump` 和 `player:land` 各一次。

**工作量：** 3 小时。 **依赖：** 建议排在 R1 第 2 项合并之后；与 A2 无冲突。

---

### B2 · 站立 NPC 整体合批（不用蒙皮就省掉约四成绘制）

**收益：** 每个 NPC 从约 25 次绘制降到约 7 次。东京（3 个 NPC）主场景约少 50 次，阴影遍再少二十多次。

**为什么现在做**

- `src/npc/spawn.ts` 对每个 NPC 永远调用 `rig.animate(dt, 0, false)`。在 `src/avatar/chibi.ts` 的 `animate` 里，`speed = 0` 且不在空中时，`legAmp`、`armAmp`、`lean`、`tuck` 全是 0：**腿、膝、臂、肘、躯干这 9 个关节的旋转目标恒为零**。真正在动的只有 `hips.position.y`（呼吸）和两只眼睛（眨眼）。
- 但 `joint()` 把 11 个关节都标成了 `kit.dynamic`，`batchStatic(root, { nested: true })` 只能在每个关节内部各合一份，于是每个 NPC 约 25 次绘制，阴影遍里还要再画一遍投影的部分。
- `UPGRADE_PLAN.md` 2.5 节写明「剩下的约 100 次里，大头是 4 个角色」。其中 3 个是这种站着不动的 NPC。
- P1-2 蒙皮估了 2–3 天且风险中等；这一项半天，改动只在 Cursor 工作区，把蒙皮要解决的问题先解决掉一大半。

**要改的文件：** `src/avatar/chibi.ts`、`src/avatar/index.ts`、`src/npc/spawn.ts`（一行）。

**具体做法**

1. `createChibiAvatar(outfitId: string, opts: { idle?: boolean } = {})`；`createAvatar(outfitId = 'default', opts?: { idle?: boolean })` 透传。
2. `chibi.ts` 里加一个不标动态的版本：
   ```ts
   function fixed(x = 0, y = 0, z = 0): THREE.Group {
     const g = new THREE.Group();
     g.position.set(x, y, z);
     return g;
   }
   const limb = opts.idle ? fixed : joint;
   ```
   `hips` 和 `head` 仍用 `joint()`；`torso`、`armL/R`、`elbowL/R`、`legL/R`、`kneeL/R` 改用 `limb()`。眼睛的 `kit.dynamic` 不变。
3. 其余代码不用动。`animate()` 仍会给这些 `Group` 写旋转值，但值恒为 0，而且它们的 mesh 已经被并进 `hips` 的合批结果里，写了也没有效果。
4. `spawn.ts`：`createAvatar(def.outfit, { idle: true })`。
5. 在 `createChibiAvatar` 的注释和 `AvatarRig` 使用处写明：站立版**不能**用来走路；将来做会走的 NPC（P1-6）时那些 NPC 用完整版。

合批后的预期结构（按 `batch.ts` 的分桶规则推算）：

| 容器 | mesh | 说明 |
|---|---|---|
| `hips` | 3 | 顶点色 mesh（投影）+ 顶点色 mesh（不投影：两只手是 `shadow: false`）+ 描边 |
| `head` | 4 | 顶点色 mesh + 描边 + 两只眼睛（R1 第 6 项合并眼睛后是 3） |

配件（斗笠、围巾等）是普通 `Group`，会分别并进 `head` 和 `hips` 的那一份，不额外占绘制。

**风险与回归**

- `setOutfit` 走的还是 `batch.restore()` → 改材质 → 重新 `batchStatic`，路径不变。
- 画面应当逐像素相同：几何、法线、颜色都一样，只是从「每关节一份」变成「全身一份」。
- 和 R1 第 6 项（合并眼睛、远处隐藏）撞 `chibi.ts` / `spawn.ts`，改动点不重叠。
- B3 需要的「头能转」已保留（`head` 仍是动态关节）；如果 B3 要做挥手，只需把 `armR` 换回 `joint()`，多 2 次绘制。

**验收标准**

- `npm run typecheck`；`npm run shots` **零差异**（若不为零，停下排查，不要更新基线）。
- 开发模式、1280×800、`?autoquality=0`、出生点：`g.engine.renderer.info.render.calls` 东京下降 ≥ 40，吉萨和巴黎（各 2 个 NPC）下降 ≥ 25。改前改后的数字写进完成记录。
- 对每个 NPC 依次 `g.bus.emit('outfit:equip', …)` 不适用（那是玩家的）；改为在控制台对一个 NPC 的 rig 调 `setOutfit` 两次，外观正确、绘制次数不变。
- NPC 仍会眨眼和呼吸（解冻后肉眼确认，或采样 `hips.position.y` 在变化）。

**工作量：** 2–3 小时。 **依赖：** 无。做完后请在 `docs/UPGRADE_PLAN.md` 的 P1-2 备注一句「站立 NPC 已用合批解决，蒙皮只剩玩家和将来会走动的 NPC 受益」，这会影响蒙皮是否值得做的判断（改文档那一步由 Claude 或 kk 决定，本项只在完成记录里提出）。

---

### B3 · NPC 会看你：转头、转身、打招呼、呼吸错开

**收益：** 走近 NPC 时他们会转头看你、靠近了会转过身来、第一次见面小跳一下；几个 NPC 不再同步呼吸。场景从「蜡像馆」变成「有人」。

**为什么现在做**

- `src/npc/spawn.ts` 一共 16 行：摆位置、设 `def.yaw`、每帧 `animate(dt, 0, false)`。玩家从背后走过来交谈，NPC 始终背对着。
- `chibi.ts` 里每个角色的 `breath` 都从 0 开始累加，NPC 同时生成，所以呼吸完全同相。
- `src/avatar/types.ts` 的注释早就写了「头部以后可能单独转动（看向玩家）」，`animate()` 也确实没有写 `head.rotation`，接口是现成的。

**要改的文件：** 新建 `src/npc/behavior.ts`；`src/npc/spawn.ts`（加一行调用，并把 `map` 的回调改成带序号）。

**具体做法**

1. `behavior.ts` 导出 `attachNpcBehavior(ctx: MapBuildContext, rig: AvatarRig, def: NpcDef, index: number): void`，内部用 `ctx.onUpdate((dt, t) => …)`，卸载地图时自动注销。
2. 每帧：
   - `p = ctx.getPlayerPosition()`；`dx = p.x - def.x`，`dz = p.z - def.z`，`d = Math.hypot(dx, dz)`。
   - `toPlayer = Math.atan2(-dx, -dz)`。这和 `Player.ts` 里 `facing` 的公式同一个约定（角色面朝 -Z）。
   - 注意范围带滞回：进入 4.0 米算「注意到」，离开 5.0 米算「不看了」。
   - **转身**：`d < 2.6` 时身体目标朝向 = `toPlayer`，否则 = `def.yaw ?? 0`。`rig.root.rotation.y` 用最短角差 + `damp(λ = 5)` 靠过去。
   - **转头**：注意到玩家时 `headYaw = clamp(最短角差(toPlayer − rig.root.rotation.y), −0.9, 0.9)`，否则 0。`rig.head.rotation.y = damp(当前, headYaw, 6, dt)`。
   - **打招呼**：刚进入注意范围、且距上次打招呼超过 20 秒时，0.3 秒内 `rig.root.position.y = 0.18 × sin(π × 进度)`，结束后归零。
   - **交谈时点头**：监听 `bus.on('npc:interact', …)` 记下正在交谈的 `npcId`，`bus.on('ui:modal', …)` 里对话关闭时清掉。交谈中 `rig.head.rotation.x = Math.sin(t * 6) * 0.06`，否则缓回 0。（`animate()` 目前不写 `head.rotation.x`；B8 会开始写，那时改成叠加，见 B8。）
   - `bus.on` 返回的取消函数要在地图卸载时调用：`ctx.onUpdate` 没有卸载钩子，做法是把监听注册成模块级的一份（记录「当前在交谈的 npcId」），每个 NPC 只读这个变量。
3. **呼吸错开**：`spawn.ts` 生成后立刻调一次 `rig.animate(0.4 + index * 0.83, 0, false)`。这只是让内部的 `breath` 相位前进一段，量是确定的。
4. 所有缓动在 `dt === 0` 时不动（`damp` 的公式天然满足：`1 − exp(0) = 0`）。打招呼的进度也只在 `dt > 0` 时前进。
5. 碰撞盒在 `ctx.add(rig.root, { collide: true })` 时已经算好，不随转身变化，不需要处理。

**风险与回归**

- `rig.root.rotation.y` 原来由 `spawn.ts` 设一次，现在每帧写；地图卡里没有别的代码碰它。
- 第 3 步会让基线里 NPC 的身体高度有不到 1.5 厘米的变化（呼吸幅度是 `0.014`），预期差异远低于 1.5% 的阈值；如果不是严格 0%，在本提交里 `--update` 并说明。
- 基线视角下玩家离导游都超过 4 米或处于冻结帧，不会触发转头。

**验收标准**

- `npm run typecheck`；`npm run shots` 通过（允许因呼吸相位产生 < 0.3% 的差异，按上面的规则处理）。
- Playwright：`g.player.teleport(5.2, 21.5, 0)`（东京导游在 `(5.2, 19.5)`，玩家站到她「背后」2 米），等 1.5 秒：`g.world.npcs[0].object.rotation.y` 和 `Math.atan2(-(px - 5.2), -(pz - 19.5))` 的最短角差 < 0.15。
- 传送到 10 米外等 2 秒，`rotation.y` 回到 `Math.PI * 0.88`（误差 0.05）。
- 肉眼或截图确认：三个 NPC 的呼吸不同步；走近时有一次小跳。
- 绘制次数不变（相对 B2 之后）。

**工作量：** 3–4 小时。 **依赖：** 建议在 B2 之后（同一批文件，且 B2 保留了 `head` 动态）。

---

### B4 · 对话镜头和对话框打磨

**收益：** 交谈时镜头自动转成「越肩双人镜头」，说话的人在画面里；对话框有停顿、有继续箭头、有进度。

**为什么现在做**

- `/workspace/c-c-2-shots/ui1080-dialogue.png`：对话框写着「我是导游小樱」，画面里是玩家的后脑勺和一棵树，小樱不在画面内。`CameraRig.update(dt, target, frozen)` 在弹窗打开时只是停住。
- `DialogueBox.step()` 每个字固定 `TYPE_MS = 42` 毫秒，逗号句号没有停顿，读起来是一口气。
- 「E / 空格 / 点击继续」常驻在右下角，看不出当前这句是否已经显示完。
- `src/ui/hud/index.ts` 的提示永远是「按 E 交谈」，不告诉你是谁。

**要改的文件：** `src/player/CameraRig.ts`、`src/player/Player.ts`（保留区）；`src/ui/dialogue/DialogueBox.ts`、`dialogue.css`；`src/ui/hud/index.ts`；`src/core/events.ts`（加 `dialogue:tick`）。

**具体做法**

镜头部分：

1. `CameraRig` 加 `setFocus(f: { yaw: number; pitch: number; distance: number; shift?: number } | null): void`。
   - 进入焦点时保存 `saved = { pitch, distance }`。
   - `update` 里有焦点时：`k = 1 − Math.exp(−6 × rawDt)`；`yaw += 最短角差(f.yaw − yaw) × k`，`pitch`、`distance` 同样按 `k` 靠近；`rawDt === 0` 时什么都不做。
   - `shift`（米）：把 pivot 沿相机右方向 `(cos(yaw), 0, −sin(yaw))` 平移，让角色偏离画面中心。对话不用，C1 用。
   - `setFocus(null)`：`pitch` / `distance` 缓回 `saved`；这段回程中只要玩家有鼠标、滚轮或方向键输入就立刻取消回程。`yaw` 不恢复。
   - 第一人称模式下 `setFocus` 直接忽略。
2. `Player`：
   - `checkNpcs` 里在 `bus.emit('npc:interact', …)` **之前**记下 `this.talkNpc = best`。
   - `bus.on('ui:modal', ({ id, open }) => …)`：`id === 'dialogue'` 且 `open` 时，在 `world.npcs` 里找到 `talkNpc`，算 `to = Math.atan2(−(nx − px), −(nz − pz))`；`side` 取 `最短角差(cam.yaw − to)` 的符号（为 0 时取 1）；`cam.setFocus({ yaw: to + side × 0.6, pitch: −0.1, distance: 4.2 })`；并记 `this.faceTarget = to`。关闭时 `cam.setFocus(null)`、`faceTarget = null`。
   - `update` 里 `faceTarget != null` 时 `this.facing = dampAngle(this.facing, faceTarget, 10 × dt)`（`Player.update` 的 `dt` 在弹窗打开时不为 0）。
   - 配合 B3，NPC 也会转过来，两人面对面。

对话框部分：

3. 标点停顿：`step()` 里根据刚显示的那个字决定下一次延时。`，、；：` → `TYPE_MS × 4`；`。！？…` → `TYPE_MS × 8`；其余 `TYPE_MS`。
4. 继续箭头：一句显示完并在等待推进时，给 `.dialogue-box` 加 `is-waiting` 类；CSS 里用 `::after` 在右下角画一个 `▼`，`animation: … steps(2, end) infinite` 上下跳 2px。打字中隐藏。原来的文字提示只在**本次页面打开后的第一段对话**显示。
5. 进度：`DialogueBox` 加可选方法 `setProgress(current: number, total: number)`，在名字牌右边显示 `2/4`；`playLines` 每句调用一次。AI 导游以后不调它也不受影响（原有五个方法的签名不变）。
6. 名字牌配色：`mountDialogue` 在 `map:loaded` 时 `box.root.style.setProperty('--dialogue-accent', card.palette.accent[0])`，`.dialogue-name` 的下边框用这个变量。
7. `step()` 里每显示两个字 `bus.emit('dialogue:tick', {})`（给 B10）。
8. HUD：`mountHud` 记下 `map:loaded` 的 `card`，`npc:nearby` 时查 `card.npcs?.find((n) => n.id === npcId)?.name`，提示改成 `E 和 小樱 交谈`；查不到退回原文。

**风险与回归**

- 焦点和 A2 的碰撞裁剪要按顺序：先按焦点更新 `yaw / pitch / distance`，再做碰撞。焦点距离 4.2 米，在窄街里仍可能被裁到更近，属于正确行为。
- 触屏上「按 E」的文案归 R1 第 2 项按 coarse 切换；这里只改桌面文案的拼法，保留它切换的入口。
- UI 改动不在基线里，要单独截图。

**验收标准**

- `npm run typecheck`；`npm run shots` 零差异。
- Playwright：`teleport(5.2, 21.3, 0)` → `bus.emit('npc:interact', { npcId: 'tokyo-guide' })` → 等 1.2 秒：把 NPC 位置（`y + 0.9`）`project(g.engine.camera)`，x、y 都在 [−0.8, 0.8] 内（NPC 在画面里）；玩家也在画面里。
- 关闭对话后 `g.player.cam.distance` 在 1 秒内回到 6。
- 截图 `/workspace/c-c-2-shots/r2-B4-dialogue-{800,1080}.png`：双人镜头、继续箭头、`2/4`。
- 一句带逗号和句号的台词，总耗时比「字数 × 42 毫秒」长（有停顿）。

**工作量：** 半天。 **依赖：** A2（`CameraRig` 的 `rawDt` 结构）；B3 做完效果才完整，但不强制。

---

### B5 · 云重画：从「碎玻璃」变成一朵一朵的像素云

**收益：** 抬头看到的是圆润的、有明暗两层的像素云，而不是横跨半个天空的直边白色多边形。

**为什么现在做**

- `/workspace/c-c-2-shots/fable-p1-water-tokyo-sky.png`：天上是几块巨大的白色梯形和尖角，直边能拉过三分之一个屏幕。`fable-p1-egypt-1280.png` 和 `fable-p1-water-egypt.png` 顶部也是同样的白色三角。
- 原因在 `src/render/sky.ts` 的片元着色器（像素风分支）：
  - `p = floor( p * 18.0 ) / 18.0` 是在**投影后的云平面坐标**里取整，格子在屏幕上被透视拉成长梯形；
  - `noise()` 在像素风下用 `step( 0.5, f.x )` 代替平滑插值，每个噪声格只有四块，`noise( p * 2.6 )` 的频率又低，于是一「朵」云就是几块大平板。
- 像素风的硬边其实不需要在坐标上做手脚：内部分辨率本来就低，**对平滑的形状做硬阈值**，边缘自然是整齐的像素台阶。

**要改的文件：** `src/render/sky.ts`（保留区）；`tools/visual-check.mjs`（加一个抬头视角，见下）。

**具体做法**

1. `noise()` 去掉 `bands > 0.0 ?` 的分支，两种风格都用平滑插值 `f * f * (3.0 − 2.0 * f)`。
2. 删掉 `if ( bands > 0.0 ) p = floor( p * 18.0 ) / 18.0;`。
3. 两种风格都用两个八度：`float n = noise( p * 1.3 ) * 0.65 + noise( p * 3.1 + 3.7 ) * 0.35;`（像素风原来只有一次，现在多一次 `noise`，只作用在没被场景挡住的天空像素上）。
4. 像素风分支改成两层硬阈值：
   ```glsl
   float m = step( thresh, n ) * step( 0.5, band );          // 云的外形
   float core = step( thresh + 0.07, n );                     // 云心（更亮）
   vec3 shade = mix( cloudColor, midColor, 0.35 );            // 云的底色：掺一点天空色
   col = mix( col, shade, m * 0.92 );
   col = mix( col, cloudColor, m * core * 0.92 );
   ```
   高清分支保持现有的 `smoothstep` 软边，只是换成上面的 `n`。
5. `thresh` 的公式（`mix( 0.8, 0.46, cloudDensity )`）先不动；换了噪声后疏密会变，三张图各看一眼，必要时只调这两个常数，不要改各图的 `cloudDensity`。
6. `visual-check.mjs`：`VIEWS` 里的 `id` 现在既是地图 id 又是基线文件名。加一个可选字段 `name`（文件名，缺省等于 `id`），`shoot` 仍按 `id` 切地图，读写基线用 `view.name ?? view.id`。然后追加一个视角：`{ id: 'tokyo', name: 'tokyo-sky', x: 0, z: 22, yaw: 0, distance: 6, pitch: 0.3 }`。

**风险与回归**

- 三张基线都有天空，**必须重截**。
- `sky.ts` 也是 R1 第 5 项（昼夜）会碰的文件，但那边只改 uniform 的值，不改着色器正文。
- 云的移动（`p.x += time * 0.03`）不变，冻结帧下仍然静止。

**验收标准**

- `npm run typecheck`。
- 本提交 `--update` 重截基线（含新增的 `tokyo-sky`）；同一提交再跑 `npm run shots` 零差异。
- 改前改后截图存 `/workspace/c-c-2-shots/r2-B5-{before,after}-{tokyo-sky,egypt,paris}.png`。对着截图检查三点：没有长度超过约 60 个内部像素的直边；云有明暗两层；吉萨（`cloudDensity 0.16`）仍然是「零星几朵」，东京 / 巴黎仍是「半天云」。
- 高清模式（开发模式按 `\` 切换）下云仍是软边、无色带断层。
- 控制台 0 错误、无着色器编译警告。

**工作量：** 2–3 小时（含调阈值）。 **依赖：** 无。

---

### B6 · 边界天际线：把四周的「纸板墙」换成有层次的远景

**收益：** 往任何方向看，地图尽头都是成片的楼 / 岩壁 / 公寓立面，而不是一堵纯色平板。

**为什么现在做**

- 三张图的 `buildEnclosure` 都是 8 块 `kit.box(46, 约 7, 1.4, …)` 的纯色墙。
  - `/workspace/c-c-2-shots/fable-p1-water-egypt.png`：西侧是一整面平的棕色板，上面贴着几个三角形（`cliffs` 的 `kit.cone`），是全游戏最像「贴图没加载出来」的一处。
  - `/workspace/c-c-2-shots/r3-t09-eiffel.png`：铁塔正后方是一堵米色墙，地标的背景是空的。
  - `/workspace/c-c-2-shots/fable-p1-tokyo-1280.png`：只有北侧有 5 栋 `tower`，左侧和身后是平墙（`r1g-avatar-close.png` 更明显）。
- 地图的雾从 36–56 米才开始（`fogNear`），墙在 42 米，雾几乎帮不上忙。
- 这些都在 Cursor 工作区，不碰保留区。

**要改的文件：** 新建 `src/art/props/backdrop.ts`，`src/art/props/index.ts` 导出；`src/maps/tokyo/index.ts`、`src/maps/egypt/index.ts`、`src/maps/paris/index.ts` 的 `buildEnclosure`；`src/art/props/README.md` 补一行；`tools/visual-check.mjs` 加视角。

**具体做法**

1. `backdrop.ts` 提供三个函数，都只用 `kit`，颜色都从调色板算出（用 `new THREE.Color(a).lerp(new THREE.Color(p.fog), k)` 做「越远越接近雾色」，和 `ground.ts` 里 `offsetHSL` 是同一类派生，不算散落色值）。随机数由调用方传入 `rand: () => number`（地图卡传 `ctx.rand`）。所有零件 `shadow: false`（在阴影范围之外，省阴影遍）。
   - `skylineRow(p, { length, rand, minH = 9, maxH = 18, layers = 2 })`：沿 X 排一行楼。每栋 = 楼身 `kit.box` + 顶沿 + 2–4 条窗带（参考 `buildings.ts` 的 `tower`，窗带 `outline: false`）。宽 3–6 米随机，楼间留 0–1.5 米。第 2 层整体退后 5 米、更高、颜色向雾色多混 0.35。给东京用。
   - `mesaRow(p, { length, rand, minH = 8, maxH = 13 })`：岩壁。每段 6–10 米宽，由 3 层逐层内收 0.6–1 米的 `kit.box` 叠成，自下而上取 `p.primary[3]`、`[2]`、`[1]`，层间高度随机；每隔 2–3 段在顶上放一块偏转 `ry` 的小岩块打破水平线。给吉萨用。
   - `facadeRow(p, { length, rand, floors = 4 })`：奥斯曼式公寓立面。每栋 7–10 米宽：墙身 `p.primary[0..2]` + 每层一排 3–4 扇窗（`COLORS.glass`，`outline: false`）+ 屋顶 `kit.prism`（`p.primary[3]` 或 `[4]`）+ 1–2 个烟囱。给巴黎用。
2. 各图 `buildEnclosure`：
   - **现有的墙保留作碰撞**，但把它的高度降到 3 米左右并改成较深的同色系（它变成「墙根」），在它**外侧 1–2 米**放对应的 `…Row`，四边各一行，用 `kit.place(row, x, z, ry)` 转向。行本身不加碰撞。
   - 吉萨：删掉贴在墙上的 10 个 `cliffs` 圆锥和 4 个 `farBank` 圆锥中与新岩壁重叠的那些；河对岸（西侧）用 `mesaRow`，高度取大值。
   - 巴黎：北侧（铁塔背后，z ≈ −44）用 `facadeRow`，并在铁塔正后方留一个 12 米宽的缺口、缺口里放更远一层（退后 8 米、向雾色混 0.5）的立面，让塔的轮廓落在浅色背景上。
   - 东京：四边都用 `skylineRow`；北侧保留现有的 5 栋 `tower` 和红白塔。
3. `visual-check.mjs`（用 B5 加的 `name` 字段）每张图追加一个侧向视角，例如 `{ id: 'egypt', name: 'egypt-west', x: 0, z: 0, yaw: Math.PI / 2, distance: 8, pitch: -0.1 }`（`yaw = π/2` 时相机在 +X 侧、朝 −X 看，正对尼罗河和西岸）；东京、巴黎各取一个现在最「平」的方向。

**风险与回归**

- 三角形会增加。现在每张图静态几何 4000–6600 个三角形；每行约 15 栋 × 约 8 个盒子 × 12 三角形 ≈ 1500，四边约 6000。合批后仍是同一个 mesh，绘制次数不变。在完成记录里写出新的三角形数；超过 2 万就把窗带减到每栋 2 条。
- `MESH_BUDGET` 只是开发模式的提示，不裁物体。
- 基线全部重截。
- 不要用 `ctx.add(..., { collide: true })` 加这些行，否则镜头碰撞（A2）会多算一批盒子。

**验收标准**

- `npm run typecheck`；本提交 `--update`，含 3 个新增侧向视角；再跑零差异。
- 改前改后截图存 `/workspace/c-c-2-shots/r2-B6-*`：每张图 4 个方向（`yaw = 0, π/2, π, −π/2`）。检查：任何方向的天际线都不是一条水平直线；吉萨西侧没有「贴在平板上的三角形」；铁塔背后有浅色远景层。
- 绘制次数不增加（±2）；三角形数写进完成记录。
- 玩家仍然走不出地图（沿四边各走一遍，或检查 `halfSize` 钳制仍在 `Player.resolveCollisions` 里生效）。

**工作量：** 一天（道具半天，三张图摆放和调色半天）。 **依赖：** 建议在 B5 之后（共用 `name` 字段，且云和天际线一起看效果）。R1 第 5 项的昼夜预设如果已落地，新增视角只截默认时段。

---

### B7 · 画面瑕疵包：细杆的虚线影子、暗色花瓣、「金条」落叶

**收益：** 去掉三处一眼就能看到的毛刺。

**为什么现在做（对着截图）**

1. **虚线影子。**
   - `/workspace/c-c-2-shots/fable-p1-paris-1280.png`：左侧路灯的影子（约 (290,275)→(380,300)）和右侧（约 (770,330)→(950,365)）是断断续续的细线。`vintageLamp` 的灯杆是 `kit.cylinder(0.055, 0.075, …)`（`src/art/props/street.ts`），直径 11–15 厘米。
   - `/workspace/c-c-2-shots/fable-p1-tokyo-1280.png`：右下有一条从约 (750,300) 斜到 (1240,690) 的点线。推断是 `utilityPole` 的横担（`kit.box(1.35, 0.08, 0.1, …)`）或杆身的影子。
   - 推断的原因：不是阴影贴图精度，而是**屏幕采样**。640×400 下，十来厘米宽的影子在贴地的斜视角里不足 1 个像素高，光栅化时断断续续。这类影子加粗一倍也救不回来，干脆不投。
2. **暗色花瓣。** 同一张东京截图里，飘着的花瓣有一半是暗红或棕色的小方块（例如 (270,100)、(830,45)、(1130,20) 附近）。`src/fx/particles.ts` 用的是 `toonMaterial(o.color)` 的小盒子，背光面落在三阶色阶的最暗一档（`toon.ts` 的 `levels = [90, 170, 255]`），粉色乘 0.35 就成了暗红。
3. **「金条」落叶。** 巴黎截图 (1180,515) 和 (570,680) 处的落叶是亮黄色的实心长方块，比旁边的草丛还大。`NEAR_FADE = [0.8, 1.6]` 只在离相机 1.6 米内才缩小。吉萨的沙尘（`p.primary[0]`，接近白色）在深色岩壁前是一片白点（`fable-p1-water-egypt.png`）。

这是 `UPGRADE_PLAN.md` P2-4（粒子形状）的具体化，加上它没提到的颜色和影子问题。

**要改的文件：** `src/art/props/street.ts`、`src/art/props/trees.ts`（只查不一定改）、`src/fx/particles.ts`、`docs/ART_GUIDE.md` 不能改（保留区），规则写进 `src/art/props/README.md`。

**具体做法**

1. 影子：
   - 规则（写进 `src/art/props/README.md`）：**最细处直径或厚度小于 0.25 米的杆、线、横梁一律 `shadow: false`**；灯头、底座、树冠照常投影。
   - `vintageLamp` 的灯杆、`streetLamp` 的灯杆和横臂、`utilityPole` 的两根横担加 `shadow: false`。`utilityPole` 的杆身（0.18–0.26 米）先保留投影，截图后如果仍是虚线再关。
   - 东京那条点线：改完后在同一视角重截，如果还在，逐个给 `src/maps/tokyo/street.ts` 和 `landmark.ts` 里厚度 < 0.25 的零件加 `shadow: false` 直到消失，把最终是哪个零件写进完成记录。
   - 棕榈、樱花树干（0.2–0.36 米）不动，吉萨截图里棕榈的影子是完整的。
2. 粒子形状：
   - `petal` / `leaf` 的几何体从 `BoxGeometry` 换成**双面菱形片**：4 个顶点的菱形（长轴 `size`，短轴 `size × 0.6`），正反各 2 个三角形共 4 个三角形、8 个顶点（正反法线相反），自己拼 `BufferGeometry`。`fx/` 里本来就直接用 three 的几何体，不违反 kit 规则。
   - `dust` / `snow` 换成 `new THREE.OctahedronGeometry(size * 0.6, 0)`。
3. 粒子颜色：
   - `FallingParticleOpts.color` 允许 `string | string[]`。材质改为 `toonMaterial('#ffffff', { emissive: 第一个颜色, emissiveIntensity: 0.3 })`，每个实例的颜色用 `mesh.setColorAt(i, …)` 按 `i` 轮流取（`kit.instances` 就是这么做的），最后 `mesh.instanceColor!.needsUpdate = true`。自发光保证背光面不会掉到暗红。
   - 东京：`color: [p.foliage[0], p.foliage[1], COLORS.sakura[0]]`。
   - 巴黎：`color: [p.accent[1], p.foliage[2], COLORS.woodLight]`（金、浅绿、枯叶色）。
   - 吉萨：`color: [p.primary[1], p.primary[2]]`（沙色，不再是近白的 `primary[0]`），`count` 220 → 140。
4. `NEAR_FADE` 改成 `[1.5, 3.5]`：离相机 3.5 米内开始缩小。

**风险与回归**

- 自发光材质不是「普通卡通材质」，但 `InstancedMesh` 本来就不参与合批，不影响。
- 粒子数量不变或减少，绘制次数不变。
- 去掉灯杆影子后路灯靠底座和灯头的影子落地；如果看起来「飘」，把底座半径加大 0.05，不要把杆影加回来。
- 基线重截（粒子、影子都在画面里）。

**验收标准**

- `npm run typecheck`；本提交 `--update`；再跑零差异。
- 改前改后截图 `/workspace/c-c-2-shots/r2-B7-{before,after}-{tokyo,paris,egypt}.png`，用和 `fable-p1-*-1280.png` 相同的机位（1280×800 出生点）。逐条对照：巴黎路灯没有虚线影子；东京右下的点线消失；东京画面里找不到暗红色的花瓣方块；巴黎近处没有比草丛大的黄色方块；吉萨岩壁前没有成片白点。
- `quality = 'low'` 时粒子仍然关闭，`'medium'` 减半（`DETAIL_SCALE` 逻辑不变）。

**工作量：** 3 小时。 **依赖：** 无。

---

### B8 · 角色外观与动作第二刀：脸、背包、落地、待机

**收益：** 玩家一直盯着的那个后背有了一个旅行背包；NPC 正面有了嘴和腮红；落地有挤压回弹，站着会轻微晃动。

**为什么现在做**

- `/workspace/c-c-2-shots/fable-p1-tokyo-1280.png` 等所有第三人称截图里，玩家是画面中心的一个棕色方块（头发）加一小截衣服，没有任何细节。玩家 100% 的时间在看这个背影。
- `/workspace/c-c-2-shots/r1g-avatar-close.png`：脸上只有两个黑方块，没有嘴，没有任何表情线索。
- `chibi.ts` 的 `animate` 对「落地」没有任何反应（`airborne` 只控制收腿和张臂）；待机只有呼吸的上下 1.4 厘米。
- 都在 Cursor 工作区。脸和背包是静态零件，会被并进 `head` / `hips` 现有的合批里，**不增加绘制次数**。

**要改的文件：** `src/avatar/chibi.ts`、`src/avatar/accessories.ts`、`src/avatar/outfits.ts`、`src/art/colors.ts`。

**具体做法**

1. 脸（加到 `head` 里，面朝 −Z，全部 `outline: false`）：
   - 嘴：`kit.box(0.07, 0.022, 0.04, MOUTH, { y: 0.085, z: -0.222 })`。
   - 腮红：左右各一块 `kit.box(0.07, 0.035, 0.04, BLUSH, { x: ±0.17, y: 0.11, z: -0.221 })`。
   - `src/art/colors.ts` 加 `blush: '#f4a6a0'`、`mouth: '#8a4a3c'`（材质固有色，集中写在这里）。
   - 眼睛高光不做（一个像素都不到）。
2. 背包（`accessories.ts` 新增 `backpack(body: string, flap: string)`，挂在 `torso`，角色背面是 +Z）：
   - 包体 `kit.box(0.3, 0.3, 0.14, body, { y: 0.2, z: 0.2 })`；
   - 翻盖 `kit.box(0.32, 0.1, 0.16, flap, { y: 0.31, z: 0.2 })`；
   - 铺盖卷 `kit.cylinder(0.06, 0.06, 0.34, COLORS.woodLight, { y: 0.4, z: 0.2, rz: Math.PI / 2, segments: 6 })`；
   - 两条肩带 `kit.box(0.04, 0.3, 0.02, flap, { x: ±0.12, y: 0.22, z: -0.14, outline: false })`。
   - `outfits.ts` 的 `'default'`（旅行者）加 `buildBodyAccessory: () => backpack('#b5533c', '#7a3626')`。别的套装不加（浴衣背包会很怪）。
3. 落地挤压和起跳拉伸（`animate` 里）：
   - 记 `prevAir`。`airborne` 从 true 变 false 的那一帧 `squash = 1`；从 false 变 true 的那一帧 `stretch = 1`。
   - 每帧 `squash = damp(squash, 0, 14, dt)`，`stretch = damp(stretch, 0, 10, dt)`。
   - `hips.scale.set(1 + 0.14·squash − 0.06·stretch, 1 − 0.2·squash + 0.12·stretch, 1 + 0.14·squash − 0.06·stretch)`。
   - `hips.position.y` 在现有公式上乘 `hips.scale.y`（即 `HIP_Y * hips.scale.y + bob + breathY`），脚才不会陷进地里或离地。
4. 待机（`walk < 0.05` 且在地面时，幅度随 `1 − walk` 淡出）：
   - 重心左右移：`hips.rotation.z = Math.sin(breath * 0.7) * 0.02`。
   - 头轻微歪：`head.rotation.z = Math.sin(breath * 0.5 + 1.3) * 0.03`。
   - **不写 `head.rotation.y`**（留给 B3）。
5. 跑步时头部回正：`head.rotation.x = lean * 0.6`（躯干前倾 0.32 弧度时头不要跟着低下去）。B3 的点头在此基础上叠加：把 B3 里的 `rig.head.rotation.x = …` 改成在 `behavior.ts` 里写一个附加量字段，或者简单些，B3 的点头改用 `rig.head.rotation.z` 之外的通道不可行时，就由 `behavior.ts` 在 `animate()` **之后**执行 `rig.head.rotation.x += nod`。`spawn.ts` 里先 `animate` 后行为，顺序固定即可。

**风险与回归**

- 嘴和腮红在 640×400 下只有 1–2 个像素，远处可能闪。如果闪得明显，把它们的厚度方向压进脸里（`z: -0.215`）或只保留腮红。
- 背包会改变所有基线里玩家的背影；嘴和腮红会改变东京基线里导游的脸。**重截基线。**
- `hips.scale` 会带着全身缩放，配件一起变，符合预期。站立版 NPC（B2）不会跳，不受影响。
- 第 3 步在 `dt === 0` 时 `damp` 不动，冻结帧安全。

**验收标准**

- `npm run typecheck`；本提交 `--update`；再跑零差异。
- 绘制次数与改前相同（背包、脸都并进现有批次）。完成记录里写改前改后的数。
- 截图 `/workspace/c-c-2-shots/r2-B8-*`：玩家背影（默认机位）、玩家正面近景（`cam.yaw = facing + Math.PI`，`distance = 3`）、8 套服装各一张（确认只有「旅行者」有背包，且其他套装的配件没有和背包穿插）。
- Playwright：起跳落地后 0.05 秒采样玩家 `avatar.root.children[0].scale.y`（`hips`）< 0.95，0.5 秒后回到 1（误差 0.01）。

**工作量：** 半天。 **依赖：** 建议在 B2、B3 之后（同一文件）。R1 第 6 项的「合并眼睛」如果还没做，可以在这一项里顺手做（做法见 R1 性能一节第 4 条）。

---

### B9 · 景点打卡：给每张图 4 个可以「到访」的地点

**收益：** 游戏第一次有了「这张图我逛完了没有」的概念：景点上方有一个小标记，走到跟前弹出名字和一句介绍，左上角显示「打卡 2/4」。

**为什么现在做**

- 现在一张图的全部玩法是走过去、和 2–3 个 NPC 各说几句话。
- 内容其实已经有了：每张图导游的 `guide.topics` 列着景点名（东京是鸟居、神社本殿、樱花参道、霓虹小街、红白铁塔），`landmark.ts` 里也有现成的坐标常量（`TORII_Z`、`SHRINE_FRONT_Z`、`SPHINX`、`GREAT`、`TOWER`）。只是没有任何系统用它们。
- 不需要改 `MapCardDef` 契约：照 `addFallingParticles(ctx, …)` 的先例，做成地图卡在 `build()` 里调用的一个 `fx` 函数，只用 `ctx.add` / `ctx.onUpdate` / `ctx.getPlayerPosition()`。
- 这也是将来 AI 导游的现成钩子（走到哪讲到哪）和存档系统的现成数据（哪些去过）。

**要改的文件：** 新建 `src/fx/poi.ts`；`src/core/events.ts`（加 `poi:visit`）；三张图的 `index.ts`（各加一次调用）；`src/ui/hud/index.ts`、`hud.css`。

**具体做法**

1. `src/fx/poi.ts`：
   ```ts
   export interface PoiDef { id: string; name: string; blurb: string; x: number; z: number; radius?: number; markerY?: number }
   export function addPois(ctx: MapBuildContext, mapId: string, pois: PoiDef[]): void
   export function visitedPois(mapId: string): ReadonlySet<string>   // 给以后的存档 / 护照用
   ```
   - 模块级 `const visited = new Map<string, Set<string>>()`。**只存在内存里**，刷新即清空；持久化归 Claude 的存档系统。
   - 每个景点一个标记：`kit.dynamic(kit.group(上下两个 kit.cone(0.22, 0.32, 4, color, { emissive: color, emissiveIntensity: 0.8, outline: false, shadow: false }) 拼成的菱形))`，`color = ctx.palette.accent[0]`，放在 `(x, markerY ?? 2.6, z)`。已到访的景点建图时就不生成标记。
   - `ctx.onUpdate((dt, t) => …)`：标记 `rotation.y = t * 1.5`、`position.y = 基准 + Math.sin(t * 2 + i) * 0.12`；玩家进入 `radius ?? 3.5` 米（只算 XZ）时：`visible = false`、写入 `visited`、`bus.emit('poi:visit', { mapId, id, name, blurb, visited: 已到访数, total: pois.length })`。
   - 地图加载完成时 HUD 需要知道初始进度：`addPois` 末尾用 `queueMicrotask` 发一次 `poi:visit` 不合适（没有到访任何点）。改为导出 `poiProgress(mapId): { visited: number; total: number }`，HUD 在 `map:loaded` 时读。`fx` 被 `ui` import 一个纯函数，不涉及 World / Engine，不违反规则 4。
2. 三张图的景点（坐标让标记落在玩家走得到的地方，实装时对照各自的碰撞盒微调）：
   - 东京：鸟居 `(0, TORII_Z + 2.5)`「神社的入口，走中间的是神明」；本殿 `(0, SHRINE_FRONT_Z + 3)`；霓虹小街 `(20, 6.6)`；红白铁塔 `(27, -29)`。
   - 吉萨：胡夫金字塔入口 `(GREAT.x, GREAT.z + GREAT.base / 2 + 3)`；狮身人面像 `(SPHINX.x + 3, SPHINX.z + 3)`；集市（取 `souq.ts` 里摊位的中心）；尼罗河岸（西侧河边，x ≈ −17）。
   - 巴黎：铁塔下 `(TOWER.x, TOWER.z + TOWER.foot + 2)`；石桥中段；咖啡馆；河边书报摊。
   - `blurb` 每条一句、不超过 24 个字，口吻和各图导游的台词一致。
3. HUD：
   - 地点牌改成 `📍 东京 · 日本 · 打卡 1/4`（`map:loaded` 时用 `poiProgress` 初始化，`poi:visit` 时更新；`total === 0` 时不显示这一段）。
   - 新增 `.hud-toast`：屏幕上方居中，`name` 一行（24px）+ `blurb` 一行（12px），显示 3.5 秒，用 `steps()` 淡入淡出，样式沿用 `.hud-place`。
   - 全部到访时多显示一行「这张图逛完了」。

**风险与回归**

- 每个标记是 1 个动态节点，嵌套合批后 1 次绘制；每张图 +4，到访后减少。**超出了 2.5 的「每项 +3」预算**，因为它是玩法物件；如果介意，把 4 个标记做成一个 `InstancedMesh`（参考 `particles.ts`，每帧 `setMatrixAt`，到访的把缩放设为 0），降到 +1。建议直接按 `InstancedMesh` 做。
- 标记在基线视角里可见（东京的鸟居正对镜头）。基线重截，或者在 `visual-check.mjs` 的 `shoot` 里没有办法隐藏它们，所以选重截。
- 发光材质现在只是「比较亮」，没有光晕（泛光归 Claude）。
- 不要把到访状态写进 `localStorage`。

**验收标准**

- `npm run typecheck`；本提交 `--update`；再跑零差异。
- Playwright：监听 `poi:visit`；`g.player.teleport(0, -5.5, 0)`（鸟居前）→ 收到一次事件，`visited === 1`、`total === 4`；原地再等 2 秒不会重复触发；切到吉萨再切回东京，该景点的标记不再出现，HUD 显示 `1/4`。
- 截图 `/workspace/c-c-2-shots/r2-B9-{marker,toast}.png`。
- 三张图各 4 个点都能走到（逐个传送到点位 1 米外再走进去，或直接检查点位不在任何碰撞盒内）。

**工作量：** 半天。 **依赖：** 无。和 B10（到访音效）、Claude 的存档 / AI 导游有接口关系，但不阻塞。

---

### B10 · 程序合成音效（不带任何素材文件）

**收益：** 脚步、跳跃、落地、对话打字、开关界面、到站、打卡都有声音。从「默片」变成游戏。

**为什么现在做**

- `rg -i "audio" src` 没有任何结果，`src/audio/` 目录还不存在（`AGENTS.md` 把它列在 Cursor 工作区里，「若有任务卡」；本项就是那张卡）。
- 像素风配芯片音色是天然搭配，用 `OscillatorNode` 和一小段噪声缓冲就够，**零素材、零依赖、不增加包体**。
- B1 提供了 `player:jump` / `player:land`，B4 提供了 `dialogue:tick`，B9 提供了 `poi:visit`；其余事件（`ui:modal`、`map:loading`、`map:loaded`、`outfit:equip`）本来就有。

**要改的文件：** 新建 `src/audio/sfx.ts`；`src/core/settings.ts`（保留区，加 `sfxVolume`）；`src/ui/settings/index.ts`（加滑块）；`src/main.ts`（挂载一行）；`src/avatar/chibi.ts`（导出步频函数）。

**具体做法**

1. `settings.ts`：`Settings` 加 `sfxVolume: number`（0–1），`defaults()` 里 `0.5`；`sanitize` 里按 `mouseSensitivity` 的写法校验并钳到 [0, 1]。设置面板加一行「音效音量」滑块（`min 0 max 1 step 0.1`），0 即静音。
2. `sfx.ts` 导出 `mountSfx(world: World): void`。和 `fx/` 一样只读访问 `World`（读 `world.playerPosition`），由 `main.ts` 传入。
   - `AudioContext` 延迟创建：第一次 `pointerdown` 或 `keydown` 时 `new AudioContext()` 并 `resume()`。这里的 `keydown` 监听**只用来解锁音频**，`{ once: true }`，不处理任何按键，不违反「快捷键只用 `keys.bind`」的规则；在代码注释里写明。
   - 一个总 `GainNode`，增益 = `getSettings().sfxVolume`，`settings:changed` 时更新。
   - `document.hidden` 时 `ctx.suspend()`，回来 `resume()`。
   - 预生成一段 0.2 秒的白噪声 `AudioBuffer`，所有噪声类音效共用。
3. 音色表（每个音效一个小函数，参数都是起点，实装时听着调）：

   | 触发 | 做法 |
   |---|---|
   | 脚步 | 噪声 → 带通 900Hz → 包络 30 毫秒，增益 0.08；左右脚音高交替 ±8% |
   | `player:jump` | 方波 320→520Hz 滑音 80 毫秒，增益 0.06 |
   | `player:land` | 噪声 → 低通 220Hz → 60 毫秒，增益按 `speed / 6.5` 缩放 |
   | `dialogue:tick` | 方波 12 毫秒，增益 0.03；音高按说话人名字的字符码之和映射到 620–980Hz（每个 NPC 一个「嗓音」） |
   | `ui:modal` 打开 / 关闭 | 三角波 660Hz / 440Hz，40 毫秒 |
   | `outfit:equip` | 两个音 520→780Hz，各 50 毫秒 |
   | `map:loading` | 噪声 → 带通从 400Hz 扫到 2000Hz，400 毫秒（「起飞」） |
   | `map:loaded` | 三个音的上行琶音，每张图一组音：东京 `[523, 659, 784]`、吉萨 `[440, 554, 659]`、巴黎 `[494, 622, 740]`（按 `card.id` 查表，查不到用第一组） |
   | `poi:visit` | 两个音 784→1047Hz，各 70 毫秒；全部到访时再接一个 1319Hz |

4. 脚步的时机：`chibi.ts` 导出 `export function stepRate(speed: number): number`，返回 `animate` 里 `phase` 的推进速率（`(7.2 + run * 3.4) * walk`，`walk` / `run` 的公式照抄并让 `animate` 也调用它，保证只有一份）。`sfx.ts` 用 `engine` 之外的手段拿不到每帧回调，所以 `mountSfx(world, engine)` 也收 `engine`，用 `engine.onUpdate`：由 `world.playerPosition` 的帧间位移算水平速度，累加 `phase += dt * stepRate(speed)`，每跨过一个 `π` 且 `playerPosition.y < 0.01` 响一次。
5. `dialogue:tick` 不带说话人。`sfx.ts` 自己监听 `npc:interact` + `map:loaded` 拿到当前 NPC 的名字；拿不到用默认音高。
6. 开局的第一次 `map:loaded`（护照还开着）不响到站音：和 `transition/index.ts` 一样判断 `map:loading` 的 `from === null`。

**风险与回归**

- 重复的短音容易烦。默认音量 0.5、脚步增益很低；对话音每两个字一次（B4 已经这么发）。
- iOS Safari 需要用户手势后才能出声，上面的延迟创建已覆盖；手机上的实际表现要等真机。
- `settings.ts` 是保留区：只加一个字段，照现有字段的模式写。旧存档没有这个字段时落到默认值（`sanitize` 的写法保证）。
- 不影响画面，`shots` 零差异。

**验收标准**

- `npm run typecheck`；`npm run shots` 零差异。
- Playwright（有头或无头都行，不验证听感）：页面里 `pointerdown` 之后 `AudioContext.state === 'running'`；在 `sfx.ts` 里留一个仅开发模式的计数器挂到 `__game.sfxCount`（各音效触发次数），走 2 秒后脚步计数在 5–9 之间，跳一次 `jump` 和 `land` 各 +1，开关一次护照 `modal` +2。
- 音量滑到 0 时总增益为 0；刷新后保持。
- 旧存档（手动把 `localStorage['ai-travel:settings']` 里的 `sfxVolume` 删掉）能正常读入。
- 请 kk 实际听一遍，这是唯一无法自动验收的部分。

**工作量：** 半天到一天。 **依赖：** B1（跳跃 / 落地事件）；B4（打字事件）和 B9（打卡音）没做时对应的音效先不接。

---

## P2

### C1 · 衣柜：能看到自己的正面，能用键盘选

**收益：** 打开衣柜时镜头转到角色正面，衣柜靠左，点一件立刻看到穿上的样子。

**为什么现在做**

- `/workspace/c-c-2-shots/ui1080-wardrobe.png`：衣柜是居中的大面板加全屏扫描线遮罩，每件衣服只有 2–3 个色块，角色被完全挡住。换装后要关掉衣柜、再转镜头才看得到效果。
- `src/ui/wardrobe/index.ts` 只有 `click`，没有方向键导航（护照有）。

**要改的文件：** `src/ui/wardrobe/index.ts`、`wardrobe.css`；`src/player/Player.ts`（保留区，接 B4 的 `setFocus`）。

**具体做法**

1. `Player`：`ui:modal` 里 `id === 'wardrobe'`，打开时 `cam.setFocus({ yaw: this.facing + Math.PI, pitch: -0.08, distance: 3.2, shift: -0.9 })`（相机转到正面，角色偏向画面右侧），关闭时 `setFocus(null)` 并把 `yaw` 也恢复（`setFocus` 加一个可选参数 `restoreYaw`）。
2. `wardrobe.css`：`.wardrobe` 改 `justify-content: flex-start`，去掉全屏的 `repeating-linear-gradient` 遮罩；`.wardrobe-book` 宽度 `min(400px, 52%)`、高度撑满。布局宽度小于 560px 时（`@media (max-width: 560px)`）退回现在的居中全宽。
3. 键盘：照 `src/ui/passport/index.ts` 的写法，`keys.bind('wardrobe', 'ArrowLeft' …)` 在所有卡片的扁平列表里移动选中项，`Enter` 换装；选中项加 `is-selected` 样式。
4. 换装时让角色转一圈：不做（需要改 `Player`，收益小）。

**风险：** 窄屏和 UI 缩放下左右分栏可能挤；媒体查询的断点按 `passport.css` 的经验可能和缩放后的布局宽度不一致（`UPGRADE_PLAN.md` 第 5 节第 17 条），用 800 / 1080 / 125% / 150% 四种截图确认。

**验收：** typecheck；shots 零差异；截图 `/workspace/c-c-2-shots/r2-C1-wardrobe-{800,1080,125,150}.png`，角色正面完整可见且不被面板遮挡；Playwright 按 B → 方向键右 → Enter，`outfit:equip` 触发且 `outfitId` 是第二套。

**工作量：** 3 小时。 **依赖：** B4（`setFocus`）。

---

### C2 · 到站：入场镜头和标题卡

**收益：** 每到一张新图，镜头从高处缓缓推到角色身后，屏幕中间出现「東京 · 樱花、鸟居与霓虹街角」的大标题，再淡出。

**为什么现在做：** 现在过场格子（`ui1080-transition.png`）散开后，直接就是默认机位，新地图的唯一文字提示是左上角 12px 的地点牌。`MapCardDef` 里的 `nameLocal` 和 `tagline` 只在护照里出现过一次。

**要改的文件：** `src/player/CameraRig.ts`、`src/player/Player.ts`（保留区）；`src/ui/hud/index.ts`、`hud.css`。

**具体做法**

1. `CameraRig.playIntro()`：记 `intro = 1`。`update` 里**只在 `!frozen && rawDt > 0` 时** `intro = Math.max(0, intro − rawDt / 1.8)`；用缓出曲线 `e = intro²` 得到附加量：距离 `+ 7·e`、俯仰 `− 0.35·e`、`yaw + 0.5·e`。附加量只加在最终算位置的局部变量上，**不写回** `this.distance / pitch / yaw`。`rawDt === 0` 时把 `intro` 直接清零（冻结帧契约）。玩家一有移动或视角输入也清零。
2. `Player`：`map:loaded` 的回调里 `teleport` 之后 `this.cam.playIntro()`。过场遮罩还盖着的时候 `frozen` 为真，`intro` 不走，遮罩散开后才开始推。
3. HUD 标题卡：`map:loaded` 时记下 `card` 并置 `pending = true`；在 `ui:modal` 事件和 `map:loaded` 之后检查 `!modals.any()`，满足且 `pending` 时显示 `.hud-title`（`nameLocal` 24px 一行，`name · tagline` 12px 一行，居中偏上），2.6 秒后用 `steps(4)` 淡出。开局护照开着，所以第一张图的标题卡在合上护照时出现。

**风险：** 入场镜头和 A2 的碰撞裁剪叠加时，推进过程中可能被建筑裁短，属于正确行为；和 B4 的焦点同时存在时焦点优先（有焦点就清掉 `intro`）。

**验收：** typecheck；shots 零差异（冻结帧下 `intro` 被清零）；Playwright 切图后 0.3 秒 `camera.position` 到玩家的距离 > 9，2.5 秒后回到 6（误差 0.1）；标题卡截图 `/workspace/c-c-2-shots/r2-C2-title-{tokyo,egypt,paris}.png`。

**工作量：** 3 小时。 **依赖：** A2。

---

### C3 · 灯下光斑和灯罩光晕（不用泛光的替代品）

**收益：** 东京的石灯笼、纸灯笼、霓虹招牌和巴黎的路灯在地上有一圈淡淡的光，灯本身外面有一层半透明的晕。

**为什么现在做：** 东京的设定是「黄昏 + 霓虹」，但 `fable-p1-tokyo-1280.png` 里霓虹招牌只是几根颜色鲜艳的柱子，石灯笼的黄色小窗和周围没有任何关系。真正的泛光是 Claude 的保留任务且要等真机；这里用两个半透明零件做一个便宜的近似。

**要改的文件：** 新建 `src/art/props/glow.ts`（并在 `index.ts` 导出）；`src/art/props/street.ts`（`stoneLantern`、`vintageLamp`、`streetLamp`、`paperLantern` 各加一两个零件）；先在 `src/maps/gallery/index.ts` 里摆一排看效果。

**具体做法**

1. `lightPool(color, r)` = `kit.cylinder(r, r, 0.004, color, { y: 0.012, segments: 8, transparent: true, opacity: 0.2, emissive: color, emissiveIntensity: 0.5, outline: false, shadow: false })`。
2. `halo(color, r)` = `kit.ball(r, color, { detail: 1, transparent: true, opacity: 0.16, emissive: color, emissiveIntensity: 0.8, outline: false, shadow: false })`。
3. 石灯笼：光斑半径 1.1（再大会盖到参道上，参道石板顶面在 y ≈ 0.09，光斑会被它挡住一截，属于正常）；晕半径 0.3，套在发光小窗外。路灯：光斑 1.6，晕 0.35。纸灯笼只加晕（它在摇，晕要加在 `sway` 节点里）。
4. 吉萨（正午）不加。
5. 半透明材质按材质各合一批（`batch.ts` 的规则），同色的光斑合成 1 个 mesh，每张图 +2 到 +4 次绘制。

**风险**

- 这是审美判断，可能看起来像「地上的色块」而不是光。**先只做 gallery 那一排并截图给 kk 看**，同意后再铺到三张图。
- 半透明物体合批后彼此不排序（`UPGRADE_PLAN.md` 第 5 节第 9 条），晕叠在橱窗玻璃前面时可能顺序不对。
- R1 第 5 项的昼夜做完后，光斑强度应当跟时段走（白天几乎没有）；现在先写死。

**验收：** typecheck；gallery 截图经 kk 确认后，在铺图的那次提交 `--update`；绘制次数增量写进记录且每张图 ≤ +4。

**工作量：** 2 小时（gallery 试做）+ 2 小时（铺图）。 **依赖：** 最好在 R1 第 5 项（昼夜）之后定强度；B6 之后重截基线更省事。

---

### C4 · 脚下的尘土：跑步和落地扬起小颗粒

**收益：** 跑起来脚后有小土块弹起，落地有一圈尘土。

**为什么现在做：** 角色和地面之间目前只有影子这一个联系；B1 之后有了 `player:land`，成本很低。

**要改的文件：** 新建 `src/fx/steps.ts`；`src/main.ts`（一行）。

**具体做法**

1. `mountStepDust(engine, world)`：一个 24 实例的 `InstancedMesh`（`OctahedronGeometry(0.05, 0)`，`toonMaterial('#ffffff')` + `setColorAt`），`markDynamic`，直接加到 `engine.scene`（它跟玩家走，不属于某张地图；这是 `fx` 层只读访问之外唯一的写操作，在完成记录里说明，或者改成在 `map:loaded` 时挂到 `world` 提供的根节点上，需要 Claude 定）。
2. 颜色取当前地图 `card.palette.ground` 向白色混 0.25（`map:loaded` 时更新）。
3. 生成：跑步（水平速度 > 5.5）时每个脚步时机（和 B10 同一个 `stepRate`）在脚后生成 2 粒；`player:land` 且 `speed > 4` 时沿一圈生成 8 粒。每粒有速度、寿命 0.35 秒，缩放随寿命到 0。用环形下标复用实例。
4. 画质 `low` 时不生成（`DETAIL_SCALE[quality] === 0`）。

**风险：** +1 次绘制；`dt === 0` 时不生成、不推进。玩家在基线里静止，零差异。

**验收：** typecheck；shots 零差异；Playwright 按住 Shift+W 跑 1 秒，`mesh.count` 或活跃粒子数 > 0；低画质下为 0。

**工作量：** 2–3 小时。 **依赖：** B1。

---

### C5 · 构图：角色放到画面下三分之一

**收益：** 角色不再挡在画面正中，前方的路和地标露出来。

**为什么现在做：** `CameraRig` 里相机 `lookAt(pivot)`，pivot 在角色腰部，所以角色永远在屏幕正中心。`/workspace/c-c-2-shots/fable-p1-water-tokyo-sky.png` 里玩家的头正好盖住鸟居；`fable-p1-egypt-1280.png` 里画面下半部分是一整片空沙地。

**要改的文件：** `src/player/CameraRig.ts`（保留区）。

**具体做法：** 轨道中心仍是 pivot，但 `camera.lookAt(pivot.x, pivot.y + LOOK_RAISE, pivot.z)`，`LOOK_RAISE = 0.55`。A2 的碰撞射线仍从 pivot 发出。俯仰下限相应从 `−1.2` 收到 `−1.1`，避免近乎垂直俯视时翻转。

**风险：** 所有基线、所有历史截图的构图都会变；第一人称不受影响。这是纯审美改动，**需要 kk 看过改前改后再决定**，所以单独一项、单独提交，随时可以回退。

**验收：** typecheck；`--update`；改前改后截图 `/workspace/c-c-2-shots/r2-C5-*`（三张图默认机位 + 东京抬头机位）；角色脚底在画面高度的 60%–72% 之间。

**工作量：** 1 小时。 **依赖：** A2。建议放在所有需要重截基线的项目之后，或者和 B6 同一批。

---

### C6 · 出生点和地面：断头路、空地面

**收益：** 出生时脚下是一个小广场而不是路的断口；大片空地有成簇的草和磨损带。

**为什么现在做**

- `/workspace/c-c-2-shots/fable-p1-egypt-1280.png` 和 `fable-p1-paris-1280.png`：路在玩家身后一步的地方齐刷刷断掉（屏幕 y ≈ 555 处），再往下是纯色地面。东京的参道（`fable-p1-tokyo-wide.png`）同样在 z ≈ 25 处截断。
- `addGroundDetail` 的草丛和石子是全图均匀撒的（`spot()` 随机取点），所以哪里都稀；色块对比度 0.03–0.045，近看几乎看不见。

**要改的文件：** 三张图的 `index.ts`；`src/art/props/ground.ts`。

**具体做法**

1. 每张图在出生点做一个小广场：以出生点为中心的 9×7 米铺装（比路面略深的同色系，`outline: false, shadow: false`，高度和路面一致），路从广场延伸到南侧房子门口。广场上放一块指路牌（两块木板 + 立柱，用 `kit` 拼，朝向地标），这是出生后第一眼的前景。
2. `GroundDetailOpts` 加可选字段 `clusters?: { rects: Rect[]; boost: number }`：在这些矩形内取点的概率乘 `boost`。把路两侧各 2 米宽的带状区域和墙根传进去，草和石子就会沿路边、墙根成簇。实现上在 `spot()` 里先按概率决定是否从 `clusters.rects` 里取点。**随机数的消耗顺序会变**，所以三张图的地面细节位置都会变一次。
3. 色块对比度：东京 0.045 → 0.06，巴黎 0.03 → 0.045，吉萨不动（沙地波纹已经够明显）。

**风险：** 基线重截；随机布局整体变化（一次性）；别把广场放进 `avoid` 之外导致色块叠在广场上闪烁，要把广场矩形加进各图的 `avoid`。

**验收：** typecheck；`--update`；三张图默认机位改前改后截图；从出生点向后转 180° 看到的是广场和通向房子的路，不是断口。

**工作量：** 半天。 **依赖：** 无；建议和 B6 连着做，少重截一次。

---

### C7 · 切图耗时：先量，再决定要不要缓存几何体

**收益：** 知道换地图那一下卡不卡、卡在哪。

**为什么现在做：** `World.build` 是同步的：`card.build()` 里每个 `kit.box` 都 `new THREE.BoxGeometry`，随后 `batchStatic` 对每个几何体跑一遍 `ensureOutlineNormals`（`toon.ts`，每个顶点拼一个字符串 key 进 `Map`），再整体 `mergeGeometry`。东京约 940 个零件。过场遮罩最少盖 1.2 秒（`MIN_HOLD_MS`），桌面上大概率看不出，但手机上这一段是主线程卡死，过场格子动画会顿住。**目前没有任何数字。**

**要改的文件：** `src/world/World.ts`（保留区，只加开发模式日志）。

**具体做法：** 在 `build()` 里用 `performance.now()` 包住 `card.build(ctx)`、`this.batch(...)`、`spawnNpcs(...)` 三段，开发模式下 `console.info('[World] tokyo 构建 38ms · 合批 21ms · NPC 6ms')`，并把最近一次的数字挂到 `__game.world` 能读到的一个只读字段上（例如 `world.lastBuildMs`），A1 的诊断面板可以顺手显示。

**下一步的判断标准：** 如果 kk 的手机上三段之和 > 250 毫秒，再做「`kit` 按参数缓存几何体 + 描边法线只算一次」（`kit.ts` 是保留区，届时单独提）。没到这个数就不做。

**验收：** typecheck；shots 零差异；开发模式切图时控制台有这行日志。

**工作量：** 0.5 小时。 **依赖：** 判断要等真机（通过 A1）。

---

### C8 · 点阵图标（引用 `UPGRADE_PLAN.md` P2-5，补充做法）

P2-5 已经列了这件事，这里只补充它没写的部分：

- **出现的位置共四处：** `src/ui/hud/index.ts` 的 `📍`、`src/npc/bubble.ts` 的 `💬`、`src/ui/settings/index.ts` 的 `⚙`、`src/ui/transition/index.ts` 的 `✈`。
- **做法：** 新建 `src/ui/icons.ts`，每个图标是一个 12×12 的字符画数组（`'#'` = 实心），导出 `icon(name): HTMLElement`，内部生成一个 `<svg viewBox="0 0 12 12" width="12" height="12" shape-rendering="crispEdges">`，每个实心格一个 `<rect>`，`fill="currentColor"`。不引入字体或图片文件。
- **为什么是 SVG 而不是 `box-shadow`：** `#ui` 有整体 CSS `zoom`（`src/ui/scale.ts`），SVG 的整数 viewBox 跟着缩放仍然对齐物理像素。
- **验收：** 800 / 1080 / 125% / 150% 四种截图里图标边缘没有半透明像素；触屏按钮（R1 第 2 项）复用同一套图标。
- **工作量：** 半天。 **依赖：** 最好在 R1 第 2 项之后，一次把触屏按钮的图标也做了。

---

### C9 · 近处斜边的描边断线（先复现，再决定）

**现象：** `/workspace/c-c-2-shots/fable-p1-water-egypt.png` 里，贴近镜头的方尖碑右侧边缘（x ≈ 520–560，从上到下）描边是规则的虚线；`fable-p1-egypt-1280.png` 左上角岩锥的斜边也有一条忽粗忽细的线。

**我没有定位到原因。** 方尖碑是 `kit.cylinder(0.16, 0.32, 3.15, …, { segments: 4, ry: π/4 })`（`src/maps/egypt/landmark.ts` 的 `createObelisk`），棱是两个面的交线，`ensureOutlineNormals` 给的外推向量是两面法线的合成。一个可能是外推量在屏幕上垂直于轮廓的分量不足 1 个内部像素；另一个可能是外壳和相邻面在深度上打架。

**建议的做法（只排查，不急着改）**

1. 在 `src/maps/gallery/index.ts` 放一个方尖碑，镜头贴近到 1.5 米，复现。
2. 开发模式下临时把 `src/render/quality.ts` 的 `OUTLINE_PX_PIXEL` 从 1 改成 1.5 看虚线是否消失；再试只对这一个物体关掉深度偏移之类的假设。**这些只是实验，不提交。**
3. 把结论写进完成记录。如果「1.25–1.5 像素」能解决且远处的线没有明显变粗，再单独提一个改默认描边粗细的提案（那会改变全部基线，需要 kk 看图决定）。

**工作量：** 1–2 小时（只排查）。 **依赖：** 无。

---

## 4. 明确推迟的事项

| 事项 | 原因 |
|---|---|
| 存档（记住上次的地图、服装、打卡、护照印章） | `tasks/README.md` 里是 Claude 的保留任务。B9 已留 `visitedPois()` / `poiProgress()` 读取口，衣柜和护照的状态都在事件里，接入时不需要改它们。 |
| AI 导游接入 | Claude 保留任务。B4 给 `DialogueBox` 加的 `setProgress` 是可选的；B9 的 `poi:visit` 可以直接当「讲解触发点」。 |
| 泛光、调色板量化、抖动、边缘检测描边 | Claude 保留任务，且泛光需要真机帧率。C3 是替代品。 |
| 碰撞升级（站到物体上、斜坡） | Claude 保留任务。B1 因此不做「土狼时间」。 |
| 完整蒙皮（P1-2） | B2 之后再评估。设计文档归 R1 第 8 项。 |
| 会走动的 NPC、更多动作（P1-6） | 需要完整版角色（非站立版）和路径数据；等蒙皮的结论。B3 只做原地的转头、转身、小跳。 |
| 像素爬行（P2-2） | 没有新的具体做法可补充；效果要在真机上边调边看。 |
| 像素风中 / 高档改硬采样阴影、粒子搬进顶点着色器、默认档位、默认 `pixelDensity` | 全部要等 A1 拿回真机数据。 |
| 跑步时的视野拉伸（改 fov） | 会和描边粗细、R1 第 4 项的竖屏 fov 打架（见 2.5）。 |
| 背景音乐 | B10 只做音效。程序生成的音乐很难不难听，等有人负责听感再说。 |
| 拍照模式（P2-10） | 等 B4 的 `setFocus` 和 C5 的构图定下来再做，否则镜头逻辑要改两遍。 |
| 小地图 / 指南针 | 地图只有 90 米见方，B9 的标记和 B6 的天际线已经能辨方向。 |
| 地图卡动态 import、级联阴影、静态阴影缓存、blit 拆分 | R1 已推迟，理由不变。 |
| 树冠分簇、建筑细节等更大范围的美术返工 | 等 B6 做完看整体效果，避免同时改近景和远景。 |

---

## 5. 建议实装顺序（给 Grok 代理的「下一句」）

> 在 `fable/upgrade` 上按 `docs/FABLE_PROPOSALS_R2.md` 第 3 节实装。顺序：
>
> **第一批（都应当 `shots` 零差异）：** A1 → A3 → A2 → B2 → B1 → B3 → B4
> **第二批（每项重截一次基线）：** B5 → B6 → C6 → B7 → B8 → B9
> **第三批：** B10 → C2 → C1 → C4 → C7
> **需要 kk 先看图点头的：** C3（先只做 gallery）、C5、C9（只排查）。C8 等触屏按钮落地后做。
>
> 规则：
>
> 1. 每一项单独一次提交，提交信息用中文，写明编号（例如「A2 镜头：第三人称相机遇墙拉近…」）。
> 2. 开始每一项之前 `git pull --rebase`；如果 R1 那条线正在改同一个文件（第 3 节每项的「依赖」里写了），先等它合并或在它之上改。
> 3. 提交前跑 `npm run typecheck` 和 `npm run shots`。第一批必须零差异，不是零就停下排查，**不要**更新基线。第二批在该项自己的提交里 `node tools/visual-check.mjs --update`，并在完成记录里写基线为什么变、存了哪些改前改后截图。
> 4. 遵守第 2 节，尤其是 2.1：任何新缓动在 `dt === 0` 时不能动、不能改写相机字段；不能用 `Math.random()` 影响画面。
> 5. 保留区文件只改该项「要改的文件」里点名的部分，并在完成记录里单列「保留区改动」。
> 6. 每项完成记录里写出 1280×800 出生点三张图的绘制次数和三角形数（开发模式 `__game.engine.renderer.info.render`，带 `?autoquality=0`）。
> 7. 截图一律存到 `/workspace/c-c-2-shots/r2-<编号>-*.png`，不要放进仓库。
> 8. 不要碰：默认画质档位、默认 `pixelDensity`、three 版本、存档、AI 导游、泛光和后期管线、蒙皮实现、`main` / `claude/*` / `gh-pages` 分支。
> 9. 某一项的验收标准达不到时，写明卡在哪里并停在那一项，不要跳过去做下一项。
