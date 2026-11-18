# Claude review · 画质升级 R1（fable/upgrade）

## 结论

分支状态良好，可以继续往前走。清晰度问题的根因处理得对：按物理像素渲染、整数倍最近邻放大、阴影补丁加 three 版本锁、`autoquality`、`visual-check` 基线，这几块互相咬合，没有看到会导致退化的缺口。

三个风险点：

1. **性能杠杆用错了位置。** 自动降档只调阴影，而阴影已降到约 15–30% 的帧时间。真正的大头是填充率，`quality` 完全不影响像素风的内部分辨率（见下文性能一节）。
2. **手机适配现在是零。** 没有触屏输入，护照和衣柜没有触屏入口，竖屏相机没有处理，后台切回没有处理。
3. **自动降档有一个实际 bug。** 标签页在后台时采样会被误判为低帧率（见性能一节）。

本轮建议顺序：

1. 性能：给自动降档加分辨率档位，并修采样 bug。
2. 手机：先做能玩的最小闭环，用 Playwright 移动视口验收。
3. 做 P1-4 时间光照的第一刀，只做光照和天空，不做夜晚发光。
4. P1-2 蒙皮不做，只做两个零风险的 draw call 削减，并设计好切片留给下一轮。

**需要等 kk 真机数据的：**

- 默认画质档位是否合适。
- 是否做静态阴影缓存（P2-7）、CSS 放大替代 blit。
- 蒙皮是否值得做。
- 手机上 `pixelDensity` 默认值的最终定档。

## 对照 UPGRADE_PLAN.md

| 项 | 状态 | 备注 |
|---|---|---|
| P0-2 阴影封顶、P0-3 锁 three、P0-4 自动降档、P0-5 视觉回归 | ✅ | 自动降档有两个缺陷，见下 |
| P1-1 阴影相机跟随玩家 | 🟡 简单版 | 级联未做 |
| P1-3 云、P1-5 水面、P1-7 three 拆包 | ✅ | |
| P1-9 `probeDynamic` | 🟡 一半 | 只收进 dev；显式 `ctx.add(obj,{dynamic})` 未做，正式构建漏标会静默静止 |
| P1-2 蒙皮、P1-4 昼夜、P1-8 手机 | ⬜ | 本轮主要对象 |
| P1-7 尾巴：地图卡动态 import | ⬜ | 需动加载契约，**不建议本轮做**，收益只在首屏 |
| P2-2 像素爬行 | ⬜ | 与昼夜/手机无关，先放 |

**文档与仓库不一致的两处：**

- 性能脚本 `fableshots.mjs` 在 `/workspace/pwtool`，不在仓库里。实装代理如果要"用现有脚本测量"，需要先确认它能访问这份脚本。
- 建议把它收进 `tools/perf.mjs`，复用 `visual-check` 的 `freezeVisual`，并输出 JSON，否则后续的 fps 对比无法复现。

## 性能（软件渲染 50 → 17–34）

### 仍在代码里的根因

1. **`quality` 不影响像素风分辨率。** `computeView`（`src/render/quality.ts`）里内部分辨率只取决于 `pixelDensity`，与 `quality` 无关。这里有一个容易被忽略的事实：`fine` 和 `normal` 在很多窗口尺寸下得到的 scale 相同。
   - 1280×800：短边 800，`fine`（目标 540）取 `round(1.48)=1`，被抬到最小 2；`normal`（360）取 `round(2.22)=2`。结果都是 640×400。
   - 只有 `coarse`（270）取 `round(2.96)=3`，得到 427×267，约少 56% 像素。
   - 所以"降档"在 1280×800 上只有降到 coarse 才会减少填充率。这正是 4× 像素带来的损失，而自动降档碰不到它。
2. **自动降档的采样 bug。** `autoQuality.ts` 的 `sampleAndMaybeDrop` 用 `requestAnimationFrame` 数帧，没有检查 `document.hidden`。
   - 加载地图时切到别的标签页或应用，rAF 暂停；切回来后 `elapsed` 已超过 2500ms 而 `frames` 只有 1，算出的 fps 约等于 0，会误降一档，并把 `autoQualityDone` 写进存档。手机上这几乎必然发生。
   - 次要问题：只量一次，用平均值，首帧里有着色器编译。建议改成跳过 hidden 期间的采样、用帧间隔的中位数、设 `ABORT` 超时。
3. **像素风下仍然开着 PCFSoft + 二值化阴影。** `shadowConfig` 在像素风 medium/high 用 `filtered: true`。每个受阴影像素是多次采样，软件渲染下很贵。`low` 已是硬采样。
4. **blit 在物理分辨率上做曝光/高光压缩/饱和度/sRGB。** 2× DPR 下是 2560×1600 的全屏着色器，而场景只有约 854×534。这是 2× 屏上 fps 掉到 8–10 的一个原因，但目前没有拆分数据，所以只能列为"待测量"。
5. **阴影遍每帧重画全部 caster。** 太阳固定，焦点吸附到像素网格，阴影图在玩家静止时几乎不变，但每帧仍整张重画。`renderer.info.render` 不统计阴影遍，所以 draw call 的实际数大约是显示数的 2 倍。
6. **角色是 draw call 大头。** 每个角色约 25 次（关节 + 描边），4 个角色约 100，外加阴影遍。`chibi.ts` 里两只眼睛各是一个独立的 dynamic mesh，每个角色白白多 2 次 draw（含阴影遍则是 4 次）。
7. **天空穹顶片元着色器。** 朝上看时是全屏噪声，hd 模式 2 次 noise 评估。像素风下已经便宜，hd 低画质没有进一步省。优先级低。
8. **每帧小分配。** `Player.update` 里 `new THREE.Vector3()`，`CameraRig.update` 里 `new Vector3`。对软件渲染帧率没有可见影响，但手机上会增加 GC 抖动，顺手可改。

### 已缓解

- 阴影贴图封顶、阴影相机跟玩家、像素风 8 位缓冲且不开 MSAA、`probeDynamic` 仅 dev、three 拆包、云和水改成着色器。

### 下一步（可在软件渲染下实施并测量）

1. **自动降档加分辨率档位。**
   - 梯子：`high → medium → low → 提高 pixel scale 一级`（即 `pixelDensity` 往 coarse 走，且不写 `qualityManual`）。
   - 默认不降，只在持续低于阈值时触发。
   - 这是唯一能在不动默认 640×400 的前提下，让弱机回到可玩帧率的杠杆。
   - 整数缩放、`visual-check` 基线不受影响，因为基线用默认设置、`?autoquality=0`。
2. **修自动降档的 hidden bug（见上）。**
3. **低画质下隔帧更新阴影。** 在 `World` 里设 `shadow.autoUpdate=false`，并在两帧里设一次 `needsUpdate=true`。焦点吸附变化的那一帧强制更新。这是 low 档的 opt-in，高/中不变。
4. **眼睛合成一个 dynamic joint。** 两只眼 scale 完全一致，放进一个 `eyes` 关节后，嵌套合批会把它合成 1 个 mesh，每个角色省 1 次 draw（含阴影遍则 2 次）。要点是把关节原点放在眼睛中心高度，mesh 在关节内 y=0，缩放才不会位移。
5. **远处 NPC 降级。**
   - 超过 `fogFar*0.9` 时设 `root.visible=false`，`animate` 也跳过。
   - 视锥外的 mesh three 本来就剔除，所以收益主要在雾里的远景。
6. **补一个 `tools/perf.mjs`。**
   - 取固定镜头、`freezeVisual`，每个配置跑 3 次，取中位数 fps，输出 JSON。
   - 配置：1280×800 的 `quality` 三档，加上 `pixelDensity=coarse`。
   - 必须把这些数字记下来，才能判断第 1 项是否值得保留。

### 必须等真机数据的

- blit 拆分或改成 CSS 放大。CSS 放大会让浏览器在非整数 DPR 下做不受控的合成，正好是之前"糊"的原因之一，没有真机数据就不要碰。
- 静态阴影缓存（P2-7）。
- 级联阴影。
- 默认画质档位。
- 手机上是否需要把 `pixelDensity` 默认再压一档。

## 手机适配现状

### 已有

- `settings.ts` 里按 `(pointer: coarse)` 判断触屏，默认 `pixelDensity: normal`、画质降一档（弱机降两档）。
- `scale.ts` 的 UI 缩放在 DPR 3 时 zoom=1，布局宽度 390 CSS px 级别。
- 设置面板有一个齿轮按钮（click）。
- `passport.css` 在 ≤720px 单列。
- 对话框的选项是按钮，可以点。

### 缺什么（第一次能在手机上玩起来所需的）

1. **没有触屏输入。** `Input.ts` 只有键盘 + 鼠标 pointer lock。`Player.update` 靠 `input.isDown('KeyW')` 等读取，`CameraRig` 靠 `consumeMouseDelta()`。
   - 最小方案：`Input` 加一个 `setVirtualMove(x, y)`、`setVirtualRun(b)`、`addLook(dx, dy)`、`pressVirtual(code)`，让触屏层只喂这几个口子，不改 Player 的物理。
   - 画布 `click` 里的 `requestPointerLock` 在触屏上无意义，应只在非 coarse 时调用。
   - 加 `touch-action: none` 和 `overscroll-behavior: none`，防止页面被拖拽或下拉刷新。
2. **护照和衣柜没有触屏入口。** 它们只有 Tab/M 和 B 快捷键。设置有齿轮，护照和衣柜没有。需要在 HUD 里加三个小按钮（护照、衣柜、设置）、一个"交谈"按钮（对应 `npc:nearby`）、一个跳跃按钮。
3. **HUD 提示文案全是键盘。** coarse 设备要换成触屏说明。
4. **竖屏相机。** `Engine` 里 fov 固定 55，竖屏时水平 fov 只有约 27°，画面像望远镜。需要在 `resize` 里按 aspect 抬高垂直 fov 或拉远 `distance`，并把规则写进 `render:view` 之后的相机更新里。
5. **安全区。** `index.html` 的 viewport 没有 `viewport-fit=cover`；HUD 的 `left/right/top/bottom: 14px` 没有 `env(safe-area-inset-*)`。刘海屏和手势条会遮住内容。
6. **后台恢复。** 没有 `visibilitychange` / `pagehide` 处理，也没有 `webglcontextlost` / `webglcontextrestored`（我 grep 过，源码里没有）。移动浏览器切后台后丢 GL 上下文是常见情况，现在会得到黑屏。
7. **输入状态在失焦时的清理。** `blur` 会清 `down`，但虚拟输入也需要在 `visibilitychange` 时清零，否则摇杆卡在按下状态。
8. **UI 字号。** 手机 DPR 3、zoom=1 时 12px 点阵字约等于 3.5–4mm。是否需要放大要真机看；如果要放大，只能取整数倍（n=4 → zoom≈1.33），布局宽度会掉到约 292 CSS px，要检查护照、衣柜、对话框是否溢出。
9. **100vh 问题。** `#app { position: fixed; inset: 0 }` 本身没问题，但弹窗的 `max-height: 100%` 在地址栏伸缩时要再看一遍。

### Playwright 可验证的

- 设备描述符（iPhone 14、Pixel 7，竖屏和横屏）、`hasTouch: true`、`isMobile: true`。
- 模拟 `touchstart/move/end` 或 `page.touchscreen.tap`，检查玩家位置变化、相机 yaw 变化、护照可打开可关闭。
- 对 `visibilitychange` 派发事件，检查输入清零、`autoQuality` 不被误触发。
- 截图检查 HUD 在刘海安全区之内（用 `env()` 的 emulation 或直接检查元素 bbox 相对于 inset）。

### 不要在这轮做的

- 陀螺仪视角。
- 低电量 API（`navigator.getBattery` 不跨浏览器，且没有真机无法判断阈值）。
- 手机上画质默认值的最终调整。

## 角色蒙皮与昼夜光照

### P1-2 蒙皮：本轮不做，只设计切片

可行性：中等，风险偏高。当前角色是 `Group` 关节加程序动画（`chibi.ts` 的 `damp` 驱动关节旋转），批合并按关节分组。要换成 `SkinnedMesh`，影响面包括：

- **描边。** `toon.ts` 的描边外壳在顶点着色器里沿法线外推，要支持骨骼变换（`skinning_vertex`、`skinnormal_vertex` chunk 的补丁），而且 three 已锁 0.170.0，字符串补丁已经有一处。
- **换装。** `outfits.ts` 的 `buildAccessory` / `buildBodyAccessory` 挂在 `head` / `torso` 这两个 Object3D 上。蒙皮后这两个必须保留为 `Bone`（或跟随骨骼的 Object3D），否则配件不跟动，`AvatarRig` 契约（`types.ts`）不能变。
- **合批。** `batchStatic(root, {nested:true})` 现在依赖关节是 dynamic 节点；蒙皮后要换一套合并逻辑。
- **视觉回归。** 角色外观会有细微变化，需要重截基线。

**建议的第一刀（留给下一轮，本轮只写设计）：**

1. 只做刚性蒙皮，每个顶点权重 1.0，骨骼等同于现有关节。
2. 先给 `toon.ts` 加骨骼描边，用一个独立的测试地图卡（`gallery`）验证。
3. 动画层不动：骨骼的 `rotation` 仍由现有 `damp` 逻辑写入，换的只是渲染。
4. 配件继续挂在 `head` / `torso`（作为骨骼）。

**本轮替代的两个零风险削减**（性能一节第 4、5 项）：合并眼睛、远处 NPC 降级。

### P1-4 昼夜光照：本轮推荐做第一刀

可行性：高。`World.applyPalette(p)` 已经是唯一入口，它设置 fog、sun、hemi、sky、grade、outline。静态几何的颜色烘进顶点色，光照变化不需要重建材质，所以改光照是纯 uniform 更新，运行时零成本。

**切片：**

- 在 `render/palette.ts` 加 `TimeOfDay = Partial<Pick<Palette, 'sky'|'skyTop'|'fog'|'fogNear'|'fogFar'|'sun'|'sunIntensity'|'sunDirection'|'skyLight'|'groundLight'|'ambientIntensity'|'exposure'|'saturation'|'outline'>>`。
- 地图卡的 `palette.ts` 可选导出 `times?: Record<'dawn'|'noon'|'dusk', TimeOfDay>`，当前调色板即默认，**不改默认值**，所以现有基线不动。
- `World.setTimeOfDay(id, durationSec)`：在当前调色板和目标预设之间做颜色和数值的线性插值，每帧只更新 uniform。
- **注意各图当前的时段：** 东京是黄昏、巴黎是清晨（落叶）、吉萨是正午。所以东京补"正午"和"清晨"，巴黎补"黄昏"，吉萨补"黄昏"，不要给每张图重复做它已有的那个时段。
- 需要新增总线事件，例如 `'time:changed'`（在 `events.ts` 加一行），供将来 UI 或 AI 导游使用。

**要注意的坑：**

- 阴影相机在 `setSunDirection` 里用 `worldUp` 叉乘，太阳 y 太小（接近地平线）时影子会拉得非常长且 `SHADOW_FAR` 可能不够。预设里把 y 限制在约 0.2 以上，并在文档里注明。
- 太阳方向变了之后，`updateShadowFocus` 的光空间网格吸附也随之换基，过渡期间阴影边缘会有一次跳动，建议过渡期间冻结吸附，或接受它。
- 天空着色器的太阳圆盘和光晕用 `sunDir`，会随预设移动，正好是想要的。
- `refreshToonMaterials` 不需要调用，因为着色器代码没变。

**夜晚需要的东西，本轮不做：** 灯笼和霓虹的发光要走独立材质（`batch` 里发光材质已按材质单独并成一个 mesh，所以可以用一个共享 uniform 驱动强度），再加泛光（P2-1）。做这些需要美术判断和真机帧率数据。

## 本轮优先事项

### 1. P0 · 自动降档加分辨率档并修后台采样 bug

- **原因：** 目前唯一真正降低填充率的杠杆不在自动降档里；后台采样会误降一档并写入存档。
- **位置：** `src/ui/autoQuality.ts`、`src/core/settings.ts`、`src/render/quality.ts`。
- **做法：**
  - 采样期间遇到 `document.hidden` 就取消并重来，或在 `visibilitychange` 时重置计时。
  - 用帧间隔的中位数，不用平均值。
  - 梯子的最后一级把有效 `pixelDensity` 往 coarse 方向降一级（不写 `qualityManual`，toast 文案相应调整）。
- **验收：** `npm run typecheck`；`npm run shots` 零差异（它带 `?autoquality=0`）；Playwright 里 `page.emulate` 隐藏页面再恢复，存档里 `autoQualityDone` 仍为 `false`；在一个人为拖慢的页面上，梯子能走到分辨率档且 `engine.view.scale` 是整数。

### 2. P0 · 触屏最小闭环（第一刀：移动、视角、按钮）

- **原因：** 手机现在完全不能玩。
- **位置：** `src/core/Input.ts`（虚拟输入口）、新建 `src/ui/touch/`（摇杆、视角拖动区、跳跃/跑/交谈按钮、护照/衣柜/设置按钮）、`src/main.ts` 挂载一行、`src/ui/hud/index.ts` 的提示文案按 coarse 切换、`index.html` 的 viewport 和 `touch-action`。
- **约束：** UI 只通过 `bus` 交互（见 AGENTS.md）。因此触屏层需要通过 `Input` 的公共口子喂输入，不要 import Player；"交谈"按钮用现有的 `npc:interact` 事件。`Input.ts` 属于保留区，这一项需要明确授权，这一轮的授权由本文给出。
- **验收：** typecheck；Playwright `iPhone 14` 横屏，摇杆推动后玩家位置变化；拖动视角后 `player.cam.yaw` 变化；点护照按钮后 `modals.isOpen('passport')`；桌面端键盘行为不变，`shots` 零差异。

### 3. P0 · 后台恢复和上下文丢失

- **原因：** 移动浏览器切后台后丢 WebGL 上下文是常见情况，现在没有任何处理。
- **位置：** `src/core/Engine.ts`。
- **做法：** 监听 `webglcontextlost`（`preventDefault`）和 `webglcontextrestored`（重建 RenderTarget、重新触发 `resize`，并让 toon 材质刷新）；`visibilitychange` 时清空输入、重置时钟，避免 dt 突变。
- **验收：** Playwright 里用 `WEBGL_lose_context` 扩展触发丢失和恢复，画面能回来、没有控制台错误。

### 4. P1 · 竖屏相机和安全区

- **位置：** `src/core/Engine.ts` 的 `resize`（按 aspect 调 fov）、`src/player/CameraRig.ts`（竖屏时拉远距离）、`index.html`（`viewport-fit=cover`）、各 UI css（`env(safe-area-inset-*)`）。
- **验收：** Playwright 竖屏截图，角色和前方地面占画面合理比例；HUD 元素的 bbox 在 inset 之内；桌面 `shots` 零差异。

### 5. P1 · P1-4 昼夜光照第一刀（光照与天空，不含夜晚）

- **位置：** `src/render/palette.ts`（类型）、`src/world/World.ts`（`setTimeOfDay` 与插值）、`src/core/events.ts`（`time:changed`）、各 `src/maps/<id>/palette.ts`（每张图补两个预设）。
- **验收：** typecheck；默认时段的 `shots` 零差异；新增视觉回归视角（每张图每个预设一张），补进基线；切换过程中控制台无错误、无 shadow 警告。

### 6. P1 · 零风险 draw call 削减

- **内容：** 合并眼睛关节；远处 NPC 超过 `fogFar*0.9` 时隐藏并跳过动画；低画质隔帧更新阴影。
- **位置：** `src/avatar/chibi.ts`、`src/npc/spawn.ts`、`src/world/World.ts`。
- **验收：** `shots` 零差异或仅眼睛位置亚像素差；`renderer.info.render.calls` 在三张图上下降；`tools/perf.mjs`（下一项）显示 fps 不变差。

### 7. P1 · 把性能脚本收进仓库

- **位置：** 新建 `tools/perf.mjs`，复用 `visual-check` 的 `freezeVisual` 和 `__game`。
- **做法：** 三张图 × `quality` 三档 × 一个 coarse 配置，每格跑 3 次取中位数，输出 JSON，并把 JSON 附进完成记录。
- **验收：** `node tools/perf.mjs` 能在开发服务器上跑完；输出里有 draw call、三角形、fps 中位数。

### 8. P2 · P1-2 蒙皮的设计文档

- **内容：** 把上文的切片写进 `docs/`，说明描边的骨骼补丁点、配件挂点、基线重截流程。**本轮不写实现。**

### 9. P2 · 小分配清理和 `ctx.add(obj,{dynamic})` 显式 API

- 只在前面各项完成后做；显式 API 需要改 `MapCard.ts` 契约，要和 Claude 确认。

### 明确推迟

- 地图卡动态 import（收益只在首屏）。
- 级联阴影。
- 静态阴影缓存。
- blit 拆分或 CSS 放大。
- 夜晚发光与泛光。
- 陀螺仪视角和低电量 API。

## 不要破坏的东西

- **整数倍放大。** 像素风下 `view.scale` 必须是整数，每个像素块严格是 scale×scale；任何降档、竖屏适配、fov 调整都不能改这一点。
- **`visual-check` 基线。** `tools/baseline/` 用默认设置 + `?autoquality=0`。新增视角时追加，不要覆盖现有三张；`--update` 只在有意改画面且在完成记录里说明时才用。
- **three 固定 0.170.0。** `toon.ts` 的字符串补丁依赖它；不要升级，不要改成 `^`。新增的骨骼描边补丁也要加 `console.warn` 兜底。
- **自动降档的行为契约。** `?autoquality=0` 关闭、玩家手动改过画质后不再插手、只提示一次；新增的分辨率档位也要遵守，并且不能写 `qualityManual`。
- **`kit.dynamic` / 合批契约。** 会动的物体必须标 dynamic；合批后零件会从场景树摘掉。新增的"眼睛关节"要标 dynamic，别的新东西也一样。
- **总线通信。** UI 不 import World / Player / Engine；快捷键用 `keys.bind`；调试对象只挂 `__game`。
- **没有密钥、没有外部贴图或 glTF、没有新依赖。**
- **分支。** 只在 `fable/upgrade` 上工作；不碰 `main`、`claude/*`、`gh-pages`，线上的 GitHub Pages 不受影响。

## 给实装代理的下一句

在 `fable/upgrade` 上按"本轮优先事项"1→7 的顺序做，每一项单独一次提交，提交前跑 `npm run typecheck` 和 `npm run shots`，除非该项明确要求新增基线，否则 `shots` 必须零差异。先改自动降档（修后台采样 bug，再加分辨率档位），再做触屏最小闭环和上下文丢失恢复，之后是竖屏相机和安全区、时间光照第一刀、零风险 draw call 削减，最后补 `tools/perf.mjs`。不要碰蒙皮实现、地图卡动态 import、夜晚发光和 blit 拆分；真机数据到位之前，不要改默认画质档位和默认 `pixelDensity`。
