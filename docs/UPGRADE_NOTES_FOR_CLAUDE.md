# 画质升级记录（fable/upgrade 分支）· 给 Claude 审阅

> 本分支由 kk 授权解除「🔒 Claude 保留区」限制，用来做画质升级。
> 这份文档记录**每一处对保留区文件的改动**：改了什么、为什么、对接口和其他模块的影响。
> 其余原则照旧：bus 通信、UI 不 import World / Engine、颜色走调色板、模型用 kit 拼、不加 npm 依赖。

## 第一轮：解决「画质太糊」

### 根因

| # | 问题 | 位置 |
|---|---|---|
| 1 | 内部分辨率太低：`pixelSize = 4` 个 **CSS 像素**一格，1280×800 只渲染 320×200，1080p 只有 480×270 | `core/Engine.ts` `core/settings.ts` |
| 2 | 完全忽略 `devicePixelRatio`：Retina（DPR 2）上一格是 8×8 物理像素；Windows 125% / 150% 缩放同理 | `core/Engine.ts` |
| 3 | `Math.ceil(w / ps)` 后再用 CSS 拉回 100%，放大倍数不是整数，像素块大小不均；`image-rendering` 后写的 `crisp-edges` 在部分浏览器还会盖掉 `pixelated` | `core/Engine.ts` `ui/base.css` |
| 4 | 描边是「外壳整体放大」，粗细是世界单位 0.04m：近处粗、稍远就不足 1 像素，断成虚线；细长物体侧面几乎没有描边 | `render/toon.ts` |
| 5 | 阴影：2048 贴图盖 120m，硬采样有锯齿；背光面自阴影条纹（树冠、斜面上的杂点） | `world/World.ts` `render/toon.ts` |
| 6 | UI 像素字体（12px 点阵）在非整数缩放下发糊；对话正文用了 14px（不是 12 的整数倍） | `ui/**` |

### 现在的渲染管线

```
场景 ──▶ 离屏 RenderTarget（内部分辨率，线性色彩，半浮点；高清模式带 MSAA）
     ──▶ 画布（全屏三角形；像素风用最近邻整数倍放大，高清 1:1 或双线性；输出时转 sRGB）
```

- 画布后备缓冲 = 它占的**物理像素**（CSS 尺寸 × DPR；用 ResizeObserver 的 `device-pixel-content-box` 修正 ±1 取整误差）。浏览器不再做任何拉伸。
- **像素风**（默认）：内部分辨率 = 物理像素 ÷ 整数 `scale`。`scale = round(物理短边 / 目标短边)`，目标短边：复古 270 / 标准 360 / 精细 540。
  所以观感只和「目标短边」有关，和 DPR 无关。内部分辨率向上取整，多出的不到 1 格在右/下边被裁掉，每格严格 `scale×scale`。
- **高清**：内部分辨率 = 物理像素（DPR 上限：低 1 / 中 1.5 / 高 2），MSAA 低 0 / 中 2 / 高 4。
- 描边：屏幕空间恒定粗细。像素风 = 1 个虚拟像素；高清 = 内部短边 / 450（最少 1.5px）。
- 阴影：贴图 低 1024 / 中 2048 / 高 4096；中高档用 PCF Soft。像素风把过滤结果按 0.5 二值化 → 轮廓平滑的硬边影子；高清保留柔边。

实测内部分辨率（默认设置：像素风 · 精细 · 高）：

| 窗口 | 改前 | 改后 |
|---|---|---|
| 1280×800 @1x | 320×200（4 CSS px/格） | 640×400（2×2 物理像素/格） |
| 1920×1080 @1x | 480×270 | 960×540（2×2） |
| 1280×800 @2x（Retina） | 320×200（8 物理像素/格） | 854×534（3×3） |

### 保留区文件改动明细

#### `src/core/Engine.ts`（重写渲染部分）

- **改了什么**：新增离屏 RenderTarget + 全屏三角形拷贝（见上）；`resize()` 改为调用 `computeView()`；
  新增只读属性 `engine.view: RenderView`；分辨率变化时广播 `render:view`，`start()` 时补发一次（UI 在 Engine 之后挂载）；
  用 ResizeObserver 监听容器尺寸，`resize()` 后立刻补画一帧（拖动窗口不闪黑）。
- **为什么**：根因 1~3。走 RenderTarget 而不是「低分辨率画布 + CSS 放大」，是因为整数倍放大可以自己在 GL 里精确控制（不依赖各浏览器 `image-rendering` 的实现），
  高清模式的 MSAA 可以运行时开关（`antialias` 上下文参数建好就不能改），以后加后期（调色板量化 / 抖动 / 泛光）也有地方插。
- **对其他模块的影响**
  - `engine.renderer.domElement.width/height` 现在是**物理像素**，不再是内部分辨率。要内部分辨率请读 `engine.view.width/height`。
  - `engine.camera.aspect` 用内部分辨率的宽高比（和窗口比差不到 1 格）。
  - `renderer.info.render` 口径不变（主场景这一遍，不含阴影遍），只是多 1 次 draw call / 1 个三角形（拷贝）。实现方式：场景那次 `autoReset = true`，拷贝那次 `false`。
  - 场景颜色先写进线性缓冲再统一转 sRGB，所以**半透明混合现在在线性空间做**（以前在 sRGB 编码后混合），半透明物体会略微变亮，属于更正确的结果。
  - 不支持浮点颜色缓冲的设备退回 8 位（暗部可能有轻微色带），只影响很老的机器。
  - Engine 现在依赖 `@/render/quality`、`@/render/toon`（设置描边粗细）。core → render 的依赖是新增的，方向上可以接受（Engine 本来就是渲染器宿主），如果你想保持 core 纯净，可以改成 toon.ts 监听 `render:view`。

#### `src/core/settings.ts`

- **改了什么**：`Settings` 去掉 `pixelSize`，新增 `renderMode: 'pixel' | 'hd'`、`pixelDensity: 'coarse' | 'normal' | 'fine'`、`quality: 'low' | 'medium' | 'high'`；
  导出类型和枚举数组（`RENDER_MODES` 等）；读存档时逐字段校验（以前是直接展开 JSON）；默认值按设备：桌面 精细 + 高，触屏设备 标准 + 中（核心数 / 内存 ≤ 4 时为低）。
- **为什么**：`pixelSize` 以 CSS 像素为单位，换屏幕观感就变，是根因 1/2 的一部分；画质需要一个档位开关。
- **影响**：**接口破坏性变更**：`getSettings().pixelSize` 没了（仓库内用到的 `debugHud.ts`、`ui/settings` 已改）。
  旧存档兼容：存储 key 不变；旧的 `pixelSize` 只在 ≤2（→ 精细）或 ≥6（→ 复古）时迁移，旧默认值 4 不沿用（它正是“糊”的来源）。

#### `src/core/events.ts`

- **改了什么**：新增事件 `'render:view': RenderView`。
- **为什么**：设置面板要显示「当前渲染 960×540 · 每格 2×2 屏幕像素」，而 UI 不能 import Engine。以后的后期 / 特效也可以监听它。
- **影响**：纯新增。events.ts 多了一个对 `@/render/quality` 的 type-only import。

#### `src/render/toon.ts`

- **描边**（根因 4）
  - `addOutline(mesh)`：去掉第二个参数 `thickness`（仓库内没有调用方传它）。外壳不再整体 `scale`，而是在顶点着色器里沿新属性 `outlineNormal` 外推，
    外推距离 ∝ 视深，所以屏幕上粗细恒定。`outlineNormal` 在 `addOutline` 时按几何体计算一次：同一位置的顶点共用一个向量 d，
    满足对该处每个面法线 n 有 n·d ≈ 1（最小二乘 + 长度上限 2），硬边不裂、细长盒子四周一样粗。
  - 新增 `setOutlineWidth(px, renderHeight, fovDeg)`，由 Engine 调用。
  - 影响：每个 kit 几何体多一个 vec3 顶点属性；「几何体要以自身中心为原点」的限制不再需要（ART_GUIDE 已更新）。
    描边材质用了 `onBeforeCompile`（基于 MeshBasicMaterial，雾照常生效）。
- **阴影补丁**（根因 5）：`toonMaterial()` 创建的材质都挂了 `onBeforeCompile = patchToonShadow`，对 three 的 `lights_fragment_begin` 里平行光那一行做字符串替换：
  1. **坡度偏移**：阴影偏移随表面相对光线的倾斜度加大。three 默认把物体**背面**渲进阴影贴图，而卡通色阶（半兰伯特）会给背光面也分配亮度，
     背光面等于自己和自己比深度，固定偏移压不住，就出条纹。原来靠 `bias -0.0005`（≈7.5cm）+ `normalBias 0.08` 硬压，仍有杂点，而且 normalBias 对背光面是反作用。
  2. **硬边阈值**：`toonShadowHard = 1` 时把阴影值 `step(0.5)`。
  - 新增 `setShadowTuning(slopeBias, hardEdge)`（World 调用）、`refreshToonMaterials()`（切换 `shadowMap.type` 后让缓存材质重编）。
  - ⚠️ **脆弱点**：补丁依赖 three r170 `lights_fragment_begin` 里那一行的原文（常量 `SHADOW_CALL`）。升级 three 后如果对不上，dev 模式会 `console.warn`，效果退回未打补丁（不会报错）。

#### `src/world/World.ts`

- **改了什么**：阴影参数从构造函数里的常量改成 `applyShadowQuality()`，监听 `settings:changed`：
  贴图尺寸 / 过滤方式来自 `shadowConfig(settings)`；`shadow.bias` 从 -0.0005 改为 -0.015m 折算值（≈ -0.0001）；`normalBias` 0.08 → 0；调用 `setShadowTuning`。
- **为什么**：根因 5。固定偏移变小后，影子和物体根部之间的缝更窄（按偏移量估算，高档下约从 7cm 降到 3cm；没有实际测量）。
- **影响**：`engine.renderer.shadowMap.type` 由 World 管（中/高 = `PCFSoftShadowMap`，低 = `BasicShadowMap`）。地图卡契约、碰撞、加载流程没动。
  阴影相机范围（±60m）没动，仍然整张图一张阴影贴图。

#### `src/main.ts`

- 加了一行 `mountUiScale(ui)`（在其他 UI 之前）。

#### `docs/ARCHITECTURE.md`、`docs/ART_GUIDE.md`、`README.md`

- 同步「像素化原理」「设置项」「描边」「自检清单里的像素大小」「开发快捷键」几处描述，没有改规则。

#### `src/art/kit.ts`

- **没有改**。`addOutline(mesh)` 调用方式不变。

### 非保留区改动

| 文件 | 改动 |
|---|---|
| `src/render/quality.ts`（新） | 画质档位表 `QUALITY`、`PIXEL_TARGET`、纯函数 `computeView()` / `shadowConfig()`、`RenderView` 类型。分辨率和档位的所有数字都在这一个文件里 |
| `src/ui/scale.ts`（新） | UI 整体缩放：`#ui { zoom: n / DPR }`，n 为整数 → 12px 点阵字永远落在整数物理像素上（125% / 150% 缩放也清晰）；大屏自动放大（1080p → ×2，4K → ×4），缩放后布局空间短边 ≥ 540。导出 `uiZoom()` |
| `src/ui/settings/**` | 像素大小滑块 → 三组分段单选（画面风格 / 像素颗粒 / 画质，原生 radio，可用方向键）+ 一行当前渲染信息；面板加 `max-height + overflow` |
| `src/ui/debugHud.ts` | `[` `]` 改为切像素颗粒，新增 `\` 切换像素风 / 高清（仅 dev） |
| `src/ui/base.css` | 画布只留 `image-rendering: pixelated` 兜底 |
| `src/ui/dialogue/dialogue.css` | 正文 14px → 12px，行高取整 |
| `src/npc/bubble.ts` | 坐标除以 `uiZoom()` 并取整；emoji 14px → 12px |
| `src/ui/passport/index.ts` | 列数改为按实际排版数（不再用 `window.innerWidth`，因为 UI 有整体缩放） |
| `src/maps/tokyo/street.ts` | 4 处电线打开描边（比 1 像素细，不描边会断成虚线；+10 个 mesh） |
| `src/maps/egypt/landmark.ts` | 金字塔最底层落地（原来悬空约 6cm，底下一圈细影子在像素风下是一排虚线） |

### 架构上需要你过目的地方

1. `src/npc/bubble.ts` 现在 `import { uiZoom } from '@/ui/scale'`（npc 表现层 → ui）。气泡本来就挂在 `#ui` 里，但方向上有点别扭；如果想更干净，可以把 `uiZoom` 挪到 `core/ui.ts`。
2. `core/Engine.ts` → `render/quality.ts`、`render/toon.ts` 的依赖（见上）。
3. 设置面板通过 `render:view` 拿分辨率，依赖「Engine.start() 时补发一次」这个约定。
4. UI 用了 CSS `zoom`（Chrome / Safari 一直支持，Firefox 126+）。老 Firefox 上不缩放，只是字在非整数 DPR 下仍会糊，不影响功能。
   `passport.css` 的 `@media (max-width: 720px)` 仍按视口宽度判断，和缩放后的布局宽度在个别窗口尺寸下不完全一致（只影响单列 / 双列切换点）。

### 验证

- `npx tsc --noEmit`、`npm run build` 通过。
- `node /workspace/pwtool/fableshots.mjs fable-r1`：三张地图都能加载，`CONSOLE_ERRORS 0`。截图在 `/workspace/c-c-2-shots/fable-r1-*.png`（对比 `fable-before-*.png`）。

  | 视口 | 地图 | meshes | draw calls | 画布（物理像素） | 内部分辨率 | fps（swiftshader 软件渲染） |
  |---|---|---|---|---|---|---|
  | 1280×800 | 东京 / 吉萨 / 巴黎 | 942 / 677 / 927 | 703 / 456 / 734 | 1280×800 | 640×400 | 20.5 / 22 / 18 |
  | 1920×1080 | 东京 / 吉萨 / 巴黎 | 942 / 677 / 927 | 733 / 443 / 753 | 1920×1080 | 960×540 | 15 / 16.5 / 14.5 |
  | 1280×800 @2x | 东京 | 942 | 701 | 2560×1600 | 854×534 | 11.5 |

  fps 是无 GPU 的软件光栅化数字，只能看相对值；我没有量改动前同一环境下的 fps，所以**没有前后对比数据**。draw call 数和改前持平（+1 次拷贝）。
- 设置面板逐项点击验证：像素颗粒 复古 / 标准 / 精细 在 1080p 下分别是 480×270 ×4 / 640×360 ×3 / 960×540 ×2；切高清后 1920×1080，画质低 / 中 / 高对应 MSAA 0 / 2 / 4；刷新后保留；旧存档 `{pixelSize: 4}` 能正常迁移。
- UI 在 DPR 1 / 1.25 / 1.5 下截图放大检查，字体像素边缘清晰；护照、设置、衣柜、对话框、过场、NPC 气泡在 1080p（UI ×2）下布局正常。

### 已知问题 / 留给后续

- **没有在真实 GPU / 真机上跑过**，只在 headless Chromium + swiftshader 下验证。高清 + 高档在 4K 集显上的帧率、手机上的表现都未实测。
- draw call 没有优化（每个 mesh + 每个描边外壳各一次）。静态几何合并 / 实例化留到后面的轮次。
- 比阴影贴图 1~2 个像素还细的物体（细绳、细杆），影子仍会断续（巴黎右侧地面有一条）。改前也有。
- Chromium 在**模拟 DPR**（DevTools 设备模式、Playwright `deviceScaleFactor`）时 `device-pixel-content-box` 报的是没乘 DPR 的值，Engine 里做了「偏差 > 1 像素就不信它」的保护，真机不受影响。
- UI 里的 emoji（📍 💬 ⚙ ✈）走系统字体，不是点阵风格。
- 像素风下镜头移动时的「像素爬行」是低分辨率 3D 的固有现象，没有处理（需要相机吸附到像素网格之类的做法）。
- 我自己在 `/tmp` 下写了几个临时截图脚本，没有进仓库；`/workspace/pwtool` 没有改动。

---

## 第二轮：性能（静态合批）+ 美术观感（天空 / 调色 / 地面细节 / 环境粒子）

提交：`e6cdbac`（合批）、`eacde8d`（光照色彩）、`8ac628e`（细节 + T11 粒子）。

### 1. 静态合批（`src/render/batch.ts`，新文件）

- `batchStatic(root, { nested })`：把子树里不动的 mesh 合并。
  - 普通卡通材质（不透明、不发光）只有颜色不同 → 颜色烘成**顶点色**，共用一个 `toonMaterial('#ffffff', { vertexColors: true })`，按 castShadow / receiveShadow 分组（最多 4 组）
  - 发光 / 半透明材质 → 按材质各合一个
  - 所有描边外壳 → 合成一个（`outlineNormal` 属性按法线矩阵一起烘焙，长度不变，和着色器里的算法等价）
  - 镜像变换（行列式 < 0）翻转绕向；不保留 uv（卡通材质不用贴图）
- **动态节点** = 合批边界，用 `kit.dynamic(obj)`（即 `markDynamic`，写 `userData.dynamic`）标记。`nested: true` 时动态节点内部在自己的坐标系里再合一份（摇晃的灯笼、鸟的身体、角色的每个关节）。
- `probeDynamic(root, updaters)`：**兜底**。用 4 个假时间点试跑地图卡注册的 `onUpdate` 回调，变换 / visible 变了的节点自动标成动态，dev 模式 `console.warn` 提示补标。
  只能抓「每帧都在动」的动画，所以三张图里已经显式标了（东京灯笼 / 闪烁招牌，吉萨驼头 / 帆 / 波纹，巴黎波纹 / 鸽子 / 翅膀）。
  ⚠️ 副作用：地图卡的 updater 在加载时会被多调 4 次（时间参数是假的）。现有 updater 都是 `t` 的纯函数，没有影响；以后写「累加 dt」的 updater 会多走 4/60 秒。
- `BatchHandle.restore()`：撤销合批（换装用）。

| 地图 | mesh 数（改前 → 改后） | draw call（1280×800 出生点视角，改前 → 改后） |
|---|---|---|
| 东京 | 942 → 171 | 701 → 123 |
| 吉萨 | 677 → 93 | 456 → 86 |
| 巴黎 | 927 → 128 | 734 → 124 |

（改后的数字包含第二轮新加的天空、地面细节、粒子共 5 次 draw call。剩下的大头是角色：每个约 25 次，4 个角色约 100 次。）

**帧时间（要如实说）**：这台机器没有 GPU（swiftshader 软件渲染），而且同时有别的任务在跑（load average 15 / 8 核），fps 读数在 8~28 之间乱跳，**量不出可靠的前后对比**。
我另外用「同步连续渲染 12 帧 + readPixels，取 8 组里最快的一组」量了一次：

| | 东京 | 吉萨 | 巴黎 |
|---|---|---|---|
| 第一轮结束（a16f7fb）· 高 | 41.3 ms | 34.6 ms | 42.7 ms |
| 第二轮结束 · 高 | 44.5 ms | 43.9 ms | 41.8 ms |
| 第二轮结束 · 低 | 20.4 ms | 17.9 ms | 20.2 ms |

也就是说：**在软件渲染下，合批没有带来可测的帧时间改善**。软件渲染的瓶颈是像素填充和阴影（关掉阴影 40 → 24 ms；阴影贴图 4096 + PCF Soft 占了约四成），不是 draw call。
draw call 降 6 倍的收益要在真实 GPU（尤其手机）上才看得到，**这一点没有实测**。第二轮加的实例化物体（地面色块 / 草 / 石子 / 粒子合计）在软件渲染下约多 5 ms（同一页面里开关对比 35.6 vs 40~43 ms，噪声很大，仅供参考），主要应是色块的重绘。

### 2. 光照与色彩

- `src/render/sky.ts`（新）：渐变天空穹顶，1 次 draw call，深度压在远平面、最后画（只填没被挡住的像素）。地平线 = 雾色 → `sky` → `skyTop`；朝太阳方向有光晕 + 硬边圆盘；像素风下切成 14 条色带，高清平滑。
- 调色（在 Engine 第 2 步的着色器里）：曝光 → 高光压缩 → 饱和度 → sRGB。
  高光压缩 = Khronos PBR Neutral **去掉暗部偏移**的版本：最亮通道 ≤ 0.8 原样输出，以上柔和压到 1 以内。
  试过 `THREE.NeutralToneMapping` 原版，暗面被压得太重（吉萨围墙、巴黎树冠发黑），所以自己写了；没用 ACES / AgX，因为它们会改调色板的色相和饱和度。
- 默认饱和度 1.15。三张图：加了 `skyTop`、`sunDirection`（东京太阳低影子长，吉萨高），雾的起止距离各拉远约 10~15%。

### 3. 地面细节 + T11

- `kit.instances(template, items)`：实例化小物件（1 次 draw call）。`addGroundDetail(ctx, opts)`（`src/art/props/ground.ts`）：地面色块（对齐网格的铺装块 / 随机朝向的沙纹，互不重叠）、草丛、石子，带避让矩形。三张图各加了路缘石。
- T11 轻量版见 `tasks/T11-ambient-fx.md` 的完成记录（云没做）。

### 保留区文件改动明细（第二轮）

#### `src/render/toon.ts`
- `ToonOptions` 加 `vertexColors?: boolean`（进缓存 key）。
- 导出 `OUTLINE_ATTR`、`ensureOutlineNormals()`；新增 `outlineShell(geo)`（`addOutline` 改为调用它，行为不变）、`isOutlineShell(obj)`。
- 影响：纯新增，`addOutline` / `toonMaterial` 原有调用方式不变。

#### `src/art/kit.ts`
- 新增 `kit.dynamic(obj)`、`kit.instances(template, items, { shadow? })`、类型 `InstanceItem`。文件头注释加了合批约定。
- 影响：kit 现在 import `@/render/batch`。原有函数没动。

#### `src/world/World.ts`
- `build()`：`card.build()` 之后、`spawnNpcs` 之前调 `this.batch()`（`probeDynamic` + `batchStatic(root, { nested: true })`）；`ctx.onUpdate` 同时把回调记进本次加载的 `updaters` 数组。
- `unload()`：释放**所有** mesh 的几何体（以前跳过 `__outline`；合并后的描边有自己的几何体。重复 dispose 无害）。
- `applyPalette()`：`scene.background` 改为雾色（兜底）；设置天空、太阳方向（`sunDirection`，距离固定 66m）、`engine.setGrade(exposure, saturation)`。
- 构造函数：把 `Sky` 的 mesh 加进场景，监听 `settings:changed` 切换色带 / 平滑。
- 影响：**被合并的零件在 build 之后会从场景树里摘掉**（原来的 Group 还在，是空的）。地图卡里拿着零件引用、之后还想改它的，必须 `kit.dynamic`。碰撞盒在 `ctx.add` 时已算好，不受影响；NPC 在合批之后生成，不受影响。

#### `src/core/Engine.ts`
- 第 2 步着色器加 `exposure` / `saturation` uniform 和高光压缩（见上）；新增 `engine.setGrade(exposure, saturation)`。
- 影响：`renderer.toneMapping` 仍是 `NoToneMapping`（不走 three 的色调映射）。所有画面都会过这条曲线：亮度 > 0.8 的颜色比以前略暗、略偏白（以前是直接截断在 1）。

#### `src/render/palette.ts`
- `Palette` 新增可选字段：`skyTop`、`sunDirection`、`exposure`、`saturation`。`sky` / `fog` 的注释更新（fog = 地平线色）。
- 影响：全是可选字段，老调色板不用改（`gallery`、`_template` 没配，天顶 = sky）。

#### `docs/**`
- `MAP_CARD_SPEC.md`（kit.dynamic / instances 约定）、`ARCHITECTURE.md`（性能一节）、`ART_GUIDE.md`（调色板新字段）各加了一两行。

### 非保留区改动（第二轮）

| 文件 | 改动 |
|---|---|
| `src/render/batch.ts`、`src/render/sky.ts`（新） | 见上 |
| `src/avatar/chibi.ts` | 关节 `kit.dynamic`，眼睛单独标动态（要眨）；`setOutfit` 里先 `restore()`、改完材质 / 配件后重新 `batchStatic(root, { nested: true })`。每个角色约 50 → 25 次 draw call |
| `src/art/props/ground.ts`（新）、`props/index.ts` | `addGroundDetail` |
| `src/fx/particles.ts`（新） | T11 |
| `src/maps/{tokyo,egypt,paris}/**` | 动态物体标记；palette 新字段；地面细节 / 路缘 / 粒子 |

### 架构上需要你过目的地方（第二轮）

1. **合批的「隐式契约」**：build 之后零件被摘掉这件事对地图卡作者不直观。现在靠 `kit.dynamic` + `probeDynamic` 兜底 + dev 警告 + 文档。如果你更想要显式的，可以去掉 probe，改成 `ctx.add(obj, { dynamic: true })`。
2. `probeDynamic` 用假时间调 updater（见上面的副作用）。
3. `kit.ts` → `render/batch.ts` → `render/toon.ts` 的依赖；`fx/particles.ts` 直接 import `core/settings`（读画质档位）和 `render/batch`。
4. 粒子用 `mesh.onBeforeRender` 读相机位置（ctx 里没有相机）。
5. 角色合批后，**外部代码在 `rig.head` / `rig.torso` 上挂的东西**照常渲染，但不会并进去；`setOutfit` 之外直接改零件材质的代码不会生效（目前没有这样的代码）。
6. 天空 mesh（`__sky`）和太阳 / 半球光一样直接挂在 `engine.scene` 上，不在地图 root 里。

### 验证（第二轮）

- `npx tsc --noEmit`、`npm run build` 通过。
- `node /workspace/pwtool/fableshots.mjs fable-r2`：三张地图都加载，`CONSOLE_ERRORS 0`。截图 `/workspace/c-c-2-shots/fable-r2-*.png`，改前对照 `fable-r2base-*.png`。
- 合批刚做完、还没动光照时，东京出生点截图和改前逐眼对比一致（描边、阴影、发光招牌都在）。
- 另外检查过：换装（`outfit:equip` → 浴衣，腰带配件正常）；道具馆（257 mesh → 15）；东京 ↔ 巴黎来回切两轮，`renderer.info.memory.geometries` 稳定（140 / 106），没有泄漏；
  画质 低 / 中 / 高 下粒子数 0 / 130 / 260；高清模式天空是平滑渐变。dev 控制台没有「未标记动态物体」的警告。

### 已知问题 / 留给后续（第二轮）

- **真实 GPU / 真机上的帧率没有测**；软件渲染下帧时间没有改善（见上）。如果要继续压软件渲染 / 低端机的帧时间，方向是阴影：
  像素风内部分辨率最多 960×540，「高」档的 4096 阴影贴图大概率是浪费的（可以试像素风封顶 2048）；或者静态阴影缓存。这两个我都没做，因为这里量不出可靠数据。
- 手机默认档位没改（触屏：标准颗粒 + 中，弱机器低）。「低」= 1024 硬阴影、无粒子，软件渲染下约 20 ms / 帧。我认为合理，但同样没有真机数据。
- 角色还是每个约 25 次 draw call（每个关节一组）。要再降得做蒙皮（SkinnedMesh），描边着色器也要跟着改。
- 合并后的静态 mesh 包围球是整张图，不再做视锥剔除（全图静态几何只有 4000~6600 个三角形，不值得分块）。
- 半透明静态物体（橱窗玻璃）按材质合并后，彼此之间的排序不再按物体远近；目前没看到问题。
- 地面色块是离地 6mm 的薄片，极远处（> 80m）理论上可能和地面闪烁，那里已经在雾里。
- 落叶 / 花瓣是小方块，不是真的叶子形状；没有做云（T11 的 `clouds.ts`）。
- 巴黎清晨配金色落叶是按任务卡写的，季节感上是否合适请美术判断。

---

## 第三轮：把软件渲染的帧率拉回来（阴影封顶、填充率、自动画质）

提交：`828aa43`（阴影与缓冲）、`99b1ab0`（自动画质与补丁可检查）。本段说明随文档一起提交。

触发：升级前同一台 swiftshader、1280×800 约 50 / 54 / 41 fps，升级后掉到约 12 / 12 / 13.5。内部分辨率从 320×200 提到 640×400 要保留（这是清晰度的来源），所以只动阴影、多余的缓冲和随画质缩放的细节。

### 做了什么

1. **阴影贴图封顶**（`shadowConfig`）：像素风 低 1024 硬采样 / 中 1024 PCF Soft / 高 2048 PCF Soft。高清 低 1024 / 中 2048 / 高 4096。MSAA 只留在高清·高（4x）；像素风本来就是 0。
2. **阴影相机跟随玩家**（P1-1 简单版）：正交范围从 ±60 米改成 ±45 米，每帧把焦点吸附到阴影贴图像素网格（和 `Camera.lookAt` 的 up=+Y 同一套轴），走路时影子边缘不抖。45 米外的物体不再投下影子。
3. **像素风离屏缓冲改为 8 位、无 MSAA**。高清仍用半浮点（设备支持时）。调色还是同一次全屏三角形 blit，没有新增 pass。8 位会把亮度 >1 的地方先截断，卡通色阶下和半浮点的差别很小；泛光以后只能接在高清这条路上，除非再把像素风改回半浮点。
4. **地面细节和粒子**共用 `DETAIL_SCALE`：低 0 / 中 0.5 / 高 1。地面仍按满数量消耗随机数，换档只改 `InstancedMesh.count`，不改 `visible`（否则加载时的动态探测会误报）。
5. **three 锁死 `0.170.0`**（去掉 `^`）。`shadowPatchApplied` 导出；没套上时始终 `console.warn`。开发模式 `__game.shadowPatchApplied` 和 `__game.qualityReport()`。
6. **自动画质**（`src/ui/autoQuality.ts`）：第一张图加载后量 2.5 秒，低于 27fps 降一档，中文 toast 只提示一次，写入 `autoQualityDone`。`qualityManual` 在玩家自己改画质时置位。`?autoquality=0` 当次关闭（不写存档）。设置里多一项「帧率过低时自动降低画质」。

### 保留区文件改动明细（第三轮）

#### `src/render/quality.ts`

- **改了什么**：`QUALITY` 不再带阴影尺寸；阴影分像素风 / 高清两张表。新增 `DETAIL_SCALE`。高清中档 `hdSamples` 从 2 改为 0。
- **为什么**：4096 软阴影和中档 MSAA 在低分辨率像素风上不划算。
- **影响**：`shadowConfig()` 的返回形状不变（`mapSize` / `filtered` / `hardEdge`）。`QUALITY` 上没有 `shadowMapSize` / `shadowFiltered` 了，仓库内没有别的调用方。

#### `src/world/World.ts`

- **改了什么**：`SHADOW_HALF` 60 → 45。太阳方向存在 `sunOffset`，每帧 `updateShadowFocus()` 把目标和灯光一起挪到吸附后的玩家位置。注册时机用 `queueMicrotask`，排在 `Player` 的 `onUpdate` 之后，用的是本帧位置。
- **为什么**：同样大小的阴影图，近处更细；贴图从 4096 降到 2048 后精度仍和旧的「2048 盖全图」接近或更好（约 4.4 厘米 / 像素，旧全图 2048 约 5.9 厘米）。
- **影响**：地图边缘、离玩家超过约 45 米的物体没有影子。契约、碰撞、加载流程没动。坡度偏移仍按「当前半边长 / 贴图尺寸」算。

#### `src/core/Engine.ts`

- **改了什么**：像素风 `UnsignedByteType`，高清才 `HalfFloatType`（不支持浮点时两边都是 8 位）。类型或 MSAA 采样数变了就重建 RenderTarget。`colorBuffer` 只读属性。`frameMs` 是 CPU 提交时间，注释里写明不能当帧时间。
- **为什么**：半浮点在软件渲染上带宽翻倍，像素风最近邻放大用不上 MSAA 的 resolve。
- **影响**：像素风不再有 >1 的线性 HDR。`engine.view.samples` 在像素风和高清低/中档是 0，只有高清·高是 4。管线仍是「场景 → 一张 RT → 一次 blit」。

#### `src/core/settings.ts`

- **改了什么**：`autoQuality`（默认 true）、`qualityManual`、`autoQualityDone`。`updateSettings(patch, origin)`，`origin === 'auto'` 时改画质不算玩家手动。
- **为什么**：自动降档不能和玩家的选择打架，也不能每次进游戏都再降一档。
- **影响**：存档多三个布尔字段，旧存档缺字段时按默认（允许自动、还没手动、还没降过）。第二个参数不传时行为和以前一样，只是「这次确实改了 quality」会把 `qualityManual` 设为 true。

#### `src/render/toon.ts`

- **改了什么**：导出 `shadowPatchApplied`。补丁对不上时的 `console.warn` 不再包在 `import.meta.env.DEV` 里。
- **为什么**：生产构建也要能看见静默退化。
- **影响**：补丁字符串和着色器行为没变。

#### `src/main.ts`

- **改了什么**：`mountAutoQuality(ui)`。开发模式 `__game` 增加 `shadowPatchApplied` 和 `qualityReport`，启动时 `console.info` 打一行。
- **为什么**：截图脚本和人工检查要能读到阴影尺寸、缓冲类型、补丁是否生效。
- **影响**：只在 dev 挂 `__game`，和以前一样。

#### `tasks/README.md`

- T11 看板状态 `todo` → `review`，与任务卡一致。云仍然没做。

### 非保留区改动（第三轮）

| 文件 | 改动 |
|---|---|
| `src/art/props/ground.ts` | 实例数量乘 `DETAIL_SCALE` |
| `src/fx/particles.ts` | 粒子比例改用 `DETAIL_SCALE`（数值和原来一样：0 / 0.5 / 1） |
| `src/ui/autoQuality.ts`、`autoQuality.css`（新） | 自动降档和一次性提示 |
| `src/ui/settings/index.ts` | 多一个复选框 |
| `package.json`、`package-lock.json` | `three` 精确 `0.170.0` |
| `/workspace/pwtool/fableshots.mjs`（不在本仓库） | 打开 `?autoquality=0`，并打印阴影尺寸 / 缓冲 / 补丁 |

### 验证（第三轮）

- `npx tsc --noEmit`、`npm run build` 通过。
- `node /workspace/pwtool/fableshots.mjs fable-p0` 与 `fable-p0b`：`CONSOLE_ERRORS 0`，三张图都加载，`shadow: 2048`、`buffer: ubyte`、`samples: 0`、`patch: true`。帧率见 `UPGRADE_PLAN.md` 2.9。
- 不带参数打开：约 7 秒后画质从「高」降到「中」，`qualityManual` 为 false，`autoQualityDone` 为 true，提示文案是「帧率偏低（约 18 帧），已自动把画质从「高」降到「中」。可以在设置里改回来。」
- `?autoquality=0`：保持「高」。
- 加载后立刻把画质改成低再改回高：保持「高」，`qualityManual` 为 true，没有提示。

### 留给后续

- 真机帧率仍未测（P0-1）。
- 软件渲染下离 50fps 的差距主要是 640×400 的填充，不是阴影贴图尺寸。再降内部分辨率会把这次清晰度还回去。
- 级联阴影没做。离玩家约 45 米以外没有影子。
- `frameMs` 不能当性能数据。

---

## 第四轮 · P0-5 视觉回归

### `src/core/Engine.ts`

- **改了什么**：内部计时改名为 `simTime`。新增只读 `engine.time`，以及 `freezeVisual(time | null)`。冻结后主循环仍每帧渲染，但 `dt = 0`、`time` 固定，并丢掉 Clock 里积压的间隔。
- **为什么**：截图要比对云、水面和粒子，这些都吃模拟时间。开发脚本通过已有的 `__game.engine` 调用，不另开全局变量。
- **影响**：正式游玩不调用它，行为和以前一样。`onUpdate` 的时间参数在冻结时停住；靠 `dt` 积分的眨眼不会自己对齐到某个相位，所以回归脚本会在模块一出来就冻结，并藏起 `#ui`。

### P1-3 天空里的云

#### `src/render/sky.ts`、`src/render/palette.ts`、`src/world/World.ts`

- **改了什么**：穹顶片元着色器里加一层噪声云（同一 draw call）。`Palette.cloudDensity` 可选。World 每帧把 `engine` 的时间传给 `sky.setTime`。云色在 `Sky.set` 里由雾色提亮再掺一点天空色。
- **为什么**：远景缺空气感，又不想为云多一次绘制。
- **影响**：`Sky.set` 多了一个可选的疏密参数，缺省 0.4。东京 / 巴黎约 0.5，吉萨 0.16。像素风下云是硬边色块并跟着原有的 `bands` 开关；高清多一层噪声、边缘稍软。太阳圆盘仍画在云之后。

### P1-5 水面

#### `src/render/water.ts`（新）、`src/art/kit.ts`、`src/world/World.ts`

- **改了什么**：`kit.waterSurface` 用 `ShaderMaterial`（带雾）画流动色带、天色和岸边泡沫。低画质 `cheap`：泡沫不起伏、色带更慢、天色掺得少。像素风把色带量化。World 每帧 `syncWaterFrame`。塞纳河、尼罗河换掉原来的色块加半透明波纹盒子。
- **为什么**：两片河是画面里最平的部分，波纹盒子还各占几次半透明绘制。
- **影响**：合批会跳过非卡通材质，河面各留 1 次绘制，波纹盒子没了。`kit` 新增 `waterSurface` / `WaterColors`，旧的 `box` 用法不变。材质不进 `toonMaterial` 缓存，换图时随几何体留在被卸载的 mesh 上（和以前的半透明波纹一样，不手动 dispose 材质）。雾 uniform 用 `UniformsLib.fog` 合并进材质，否则 three r170 在 `refreshFogUniforms` 里会读到空的 `fogColor`。时间 uniform 在 merge 之后指回共享对象，否则每条河各冻在 0 秒。

### P1-7 分包

#### `vite.config.ts`（不在保留区清单里，记一笔）

- **改了什么**：`manualChunks` 把 `node_modules/three` 打成单独的 `three` 包。
- **为什么**：主包超过 vite 的 500KB 提示。three 几乎不变，拆出去可以长期缓存。
- **影响**：入口不再静态内联 three。这次构建大约是入口 100KB、three 475KB（gzip 38KB / 120KB），没有超过 500KB 的警告。地图卡仍是静态 import：护照和过场首屏就要调色板和地名，对话兜底还要扫全部 NPC，改成动态 `import()` 得动 `MapCard` 的加载契约和这三处，这轮没做。

### P1-9 合批探测只在开发模式跑

#### `src/world/World.ts`

- **改了什么**：`probeDynamic` 包在 `import.meta.env.DEV` 里。正式构建直接合批，不再用 4 个假时间点试跑 updater。
- **为什么**：那 4 次调用是隐式副作用（累加 dt 的动画会在加载时多走约 4/60 秒），而且三张图已经显式 `kit.dynamic`。
- **影响**：正式构建里漏标的物体会被并进静态 mesh，动画不动，也没有警告。开发模式行为不变（控制台仍会 warn）。没有改 `MapCard` 契约，也没有加 `ctx.add(obj, { dynamic })`。`getCameraPosition()` 没做。

### 文档

`docs/UPGRADE_PLAN.md` 第 4 节打了勾（P0-5、P1-3、P1-5、P1-7、P1-9 的探测一半），2.9 补了本轮两次帧率。帧率两次差一倍，不能当成云或水面的稳定开销。

---

## R1-1 · 自动降档：后台采样 + 分辨率档

### `src/ui/autoQuality.ts`、`src/render/quality.ts`、`src/core/settings.ts`

- **改了什么**：有效帧时间累计满 2.5 秒后，用帧间隔的**中位数**算 fps（不再用墙钟平均）。`document.hidden`，或单帧间隔超过 1 秒，整段采样作废重来，不写 `autoQualityDone`。画质已经是低、且是像素风时，最后一级把 `pixelDensity` 往复古降一档（`coarserPixelDensity`）。这一步 `updateSettings(..., 'auto')`，不写 `qualityManual`。提示文案会写「分辨率」。
- **为什么**：后台 rAF 暂停时，墙钟已经超过 2.5 秒而帧数只有 1，会被当成约 0 帧并写进存档。另外 `quality` 降到低之后，1280×800 上只有把颗粒降到复古才会少掉填充率（精细和标准的 scale 都是 2，复古是 3）。
- **影响**：默认画质和默认 `pixelDensity` 没变。`?autoquality=0` 仍是当次关闭。玩家手动改画质之后，画质和颗粒都不再自动改。整数倍放大仍由 `computeView` 保证。高清模式没有颗粒这一档（`pixelDensity` 不影响高清分辨率）。

### 验证

- `npm run typecheck` 通过。`npm run shots`：东京 / 吉萨 / 巴黎 0.00%，`CONSOLE_ERRORS 0`。
- `node tools/autoquality-hidden.mjs`：采样中暂停 rAF 4 秒并拨到 `document.hidden`，恢复后几百毫秒内存档仍是高画质、精细、`autoQualityDone=false`。低画质 + 标准颗粒、每帧空转约 45ms：降到复古，`qualityManual=false`，`scale=3`，内部分辨率 427×267，提示含「分辨率」。

---

## R1-2 · 触屏最小闭环

### `src/core/Input.ts`（保留区，R1 评审授权）

- **改了什么**：新增 `setVirtualMove(x, y)`、`setVirtualRun(on)`、`addLook(dx, dy)`、`pressVirtual(code)`、`releaseAll()`。摇杆过死区后并进 `isDown` 的 WASD / Shift，点按并进 `wasPressed`，视角增量并进原来的鼠标位移。`pointer: coarse` 时点击画布不请求 pointer lock。`blur` 时键盘和虚拟输入一起清掉。
- **为什么**：手机上没有键盘和 pointer lock，玩家移动代码不必改。
- **影响**：桌面键盘 / 鼠标路径不变（虚拟集合默认是空的）。`isDown` / `wasPressed` 现在也会看到虚拟按键。

### `src/ui/touch/`、`src/ui/hud/`、`src/main.ts`、`index.html`、`src/ui/base.css`

- **改了什么**：coarse 指针才挂一层：左摇杆、右侧滑动转视角、跳 / 跑 / 交谈、右上角护照（KeyM）/ 衣柜（KeyB）/ 设置（KeyP）。交谈在 `npc:nearby` 有人时发 `npc:interact`。弹窗打开时收起摇杆和视角区。HUD 提示改成触屏说明。`html/body` 加 `touch-action: none` 和 `overscroll-behavior: none`。viewport 加上 `viewport-fit=cover`。开发模式 `__game.modals` 指向现有的弹窗栈，方便冒烟读 `isOpen`。
- **为什么**：护照和衣柜以前只有键盘快捷键。
- **影响**：精细指针不创建这层。开局护照仍然默认打开，触屏用同一个护照键合上。

### 验证

- `npm run typecheck` 通过。`npm run shots` 三张图 0.00%。
- `node tools/touch-smoke.mjs`（Chromium + iPhone 14 横屏视口、`hasTouch`）：`pointer: coarse` 为真；摇杆推动约 2.99 米；向右拖视角 yaw 从 0 到 -0.27；没有 pointer lock；护照按钮能打开 `modals.isOpen('passport')`。

---

## R1-3 · 后台恢复和上下文丢失

### `src/core/Engine.ts`

- **改了什么**：监听 `webglcontextlost`（`preventDefault`，暂停主循环）和 `webglcontextrestored`（丢掉旧的离屏目标和灯光阴影图，不 `dispose`；重建 RenderTarget、`resize`，`refreshToonMaterials()`）。`visibilitychange` 时 `input.releaseAll()`，并 `clock.getDelta()` 丢掉积压间隔。three 自己也会 preventDefault 并重建 GL 状态，这里补的是它不管的离屏缓冲和卡通材质。
- **为什么**：手机切后台经常丢 WebGL 上下文，不处理就是黑屏。回来时 Clock 的间隔会顶到 dt 上限，角色会跳一步。
- **影响**：正常路径不进这两个分支。阴影图在恢复后由 three 按灯光上的 `mapSize` 重建。旧 GPU 资源不调用 `dispose`，避免在新上下文里删掉刚分配的 id。

### `src/ui/touch/index.ts`

- 页面隐藏时把摇杆旋钮归位，并清掉虚拟移动和跑步。Engine 也会 `releaseAll`，这里只是让按钮画面和输入一致。

### 验证

- `npm run typecheck` 通过。`npm run shots` 三张图 0.00%（这项改动和竖屏 fov 分开提交；fov 那次提交前也跑过 0%）。
- `node tools/context-restore.mjs`：`setVirtualMove` 之后派发 `visibilitychange`，`KeyW` 松开。`WEBGL_lose_context` 丢失再恢复，控制台无 error，截图抽样亮点约 6.4 万（不是黑屏）。

---

## R1-4 · 竖屏相机和安全区

### `src/core/Engine.ts`、`src/player/CameraRig.ts`

- **改了什么**：`resize` 里按内部分辨率的宽高比设垂直 fov。宽大于等于高时仍是 55°。竖屏把水平 fov 抬到大约 50°，垂直 fov 封顶 82°（iPhone 14 竖屏内部分辨率约 0.59，实际约 77°）。第三人称用 `portraitDistance`：竖屏距离乘上 `1 + (1 - aspect) * 0.28`，上限 16 米；不改 `cam.distance` 本身，滚轮仍调原来的值。横屏乘数是 1。
- **为什么**：fov 固定 55° 时，竖屏水平只有大约 30°，像望远镜。
- **影响**：1280×800 和 1920×1080 的 fov 和距离不变，所以现有基线不动。第一人称不拉远。

### UI

- `viewport-fit=cover` 在触屏那次提交里已经加上。
- HUD 地点 / 提示 / 交谈、设置齿轮、自动降档提示、护照、衣柜、设置、对话框的边距改成 `env(safe-area-inset-*)`。桌面 inset 是 0，位置和原来一样。触屏层在上一提交里已经用了 inset。

### 验证

- `npm run typecheck` 通过。`npm run shots` 三张图 0.00%。
- iPhone 14 竖屏（390 CSS 宽，`hasTouch`）：fov 约 76.9°，地点标签在视口内（top/left 14）。截图 `/workspace/c-c-2-shots/fable-r2-phone-tokyo.png`、`fable-r2-phone-egypt.png`。角色、前方路面和地标都在画面里，不是一条窄缝。这两张不进 `tools/baseline`。

---

## R1-5 · 时段光照第一刀

### `src/render/palette.ts`、`src/world/MapCard.ts`、`src/core/events.ts`、`src/world/World.ts`

- **改了什么**：`TimeId` / `TimeOfDay`。地图卡可选 `times`。`World.setTimeOfDay(time, durationSec)` 从当前光照插到预设，只写雾、太阳、半球光、天空穹顶、曝光和描边色。`durationSec = 0` 立刻跳。总线事件 `time:changed`（`time: null` 表示回到默认调色板）。地址栏 `?time=dawn|noon|dusk` 在加载时套用（这张图没有该预设就忽略）。太阳方向先归一化，y 低于 0.2 就抬到 0.2 再归一化；现有三张默认方向都高于这个值，所以默认影子不变。过渡时阴影焦点跟着新方向走，换基的那一帧影子边缘会跳一下。
- **为什么**：同一张图换氛围，又不重烘顶点色、不动默认画面。
- **影响**：`MapCardDef` 多了一个可选字段，旧卡不用填。几何体颜色、水面在建造时取的调色板颜色都不变。没有夜晚，没有灯笼发光。

### 各地图补的预设（默认调色板一个字没改）

| 图 | 默认 | 新增 |
|---|---|---|
| 东京 | 黄昏 | 清晨、正午 |
| 巴黎 | 清晨 | 黄昏、正午 |
| 吉萨 | 正午 | 黄昏、清晨 |

### 验证

- `npm run typecheck` 通过。`npm run shots`：原来三张 0.00%。新视角缺基线时脚本会新建（没有 `--update`），第二次再跑这 6 张也是 0.00%，`CONSOLE_ERRORS 0`。基线：`tools/baseline/tokyo-noon.png`、`tokyo-dawn.png`、`paris-dusk.png`、`paris-noon.png`、`egypt-dusk.png`、`egypt-dawn.png`。
- 开发模式可以直接 `__game.world.setTimeOfDay('noon', 1.2)`。

---

## R1-6 · 零风险 draw call 削减

### `src/avatar/chibi.ts`

- 左右眼放进同一个 `eyes` 关节，关节原点在眼睛中心 `(0, 0.18, -0.22)`，两只眼本地 y=0。眨眼只改这个关节的 `scale.y`，不会把眼睛往头的原点拉。关节标了 dynamic，里面的两只眼由嵌套合批合成 1 个 mesh。
- 1280×800、默认高画质、`renderer.info.render.calls`（不含阴影遍）：东京 125→121，吉萨 82→79，巴黎 120→117。三角形没变（21441 / 17529 / 18869）。每个角色少 1 次主场景绘制。

### `src/npc/spawn.ts`

- 和玩家的水平距离超过当前雾 `far * 0.9` 时 `root.visible = false`，并且不调用 `animate`。雾远会随时段变，所以读场景上的 fog，读不到再用调色板的 `fogFar`。现有三张图的出生点附近没有人远到这条线，所以基线画面不变。

### `src/world/World.ts`

- 只在画质为低时把 `shadowMap.autoUpdate` 设为 false，隔帧 `needsUpdate = true`。阴影焦点相对上一帧变了就当帧强制更新。中 / 高保持原来的每帧更新。`shots` 用的是默认高画质。

### 验证

- `npm run typecheck` 通过。`npm run shots` 九张（含时段）全部 0.00%，`CONSOLE_ERRORS 0`。眼睛没有可记录的像素差。

---

## R1-7 · 性能脚本

### `tools/perf.mjs`、`package.json`、`.gitignore`

- **改了什么**：`npm run perf`。Playwright 开 Chromium（`--use-gl=swiftshader --enable-unsafe-swiftshader --ignore-gpu-blocklist`），1280×800，`?autoquality=0`，`freezeVisual(1.5)`，镜头和视觉回归同一套。三张图 × 画质低/中/高（颗粒精细），再加画质高 × 颗粒复古。每格 rAF 量 1.2 秒、3 次，取中位数。JSON 打到 stdout，并写 `tools/perf-last.json`（gitignore）。画质通过存档再刷新生效：在页面里动态 import settings 会拿到另一份模块，引擎听不见。
- **为什么**：以前的测量脚本在仓库外，换一台机器对不上数字。
- **影响**：不改默认画质，不改默认颗粒。复古在 1280×800 上 `scale` 是 3，内部分辨率 427×267，仍是整数倍。

### 这一次的中位数（swiftshader，只能看相对值，三次之间能差 10 帧）

| 图 | 低/精细 | 中/精细 | 高/精细 | 高/复古 |
|---|---|---|---|---|
| 东京 | 48.3 | 41 | 32.3 | 35 |
| 吉萨 | 40.2 | 46.4 | 37.9 | 23 |
| 巴黎 | 58.8 | 45.8 | 36.6 | 23.6 |

高画质主场景 draw call（这个固定镜头，不含阴影遍）：东京 122、吉萨 79、巴黎 64。出生点不固定镜头时巴黎是 117（镜头外的东西被视锥剔掉了）。三角形在低画质更少，是地面细节和粒子关掉了，不是这次的关节合并。复古这一档没有稳定地比精细更快，噪声盖过了 427×267 和 640×400 的差别，所以默认颗粒不动。

`node /workspace/pwtool/fableshots.mjs fable-r2`：`CONSOLE_ERRORS 0`。截图在 `/workspace/c-c-2-shots/fable-r2-*.png`（另有竖屏 `fable-r2-phone-tokyo.png`、`fable-r2-phone-egypt.png`）。出生点、单次 2 秒 rAF：1280 东京 / 吉萨 / 巴黎 21 / 35.5 / 32 fps；1920 21 / 23 / 22；Retina 东京 15。和以前写的 19 / 20 / 17.5 不是同一次、也不是冻结镜头，不能当成这次改动的收益。阴影 2048、缓冲 ubyte、补丁 true。

---

## R2-A1 · 真机诊断面板

### 保留区改动

- `src/core/events.ts`：新增 `'perf:sample'`（fps、worstMs、calls、triangles、gpu）。探针只读，不改设置。
- `src/main.ts`：挂上 `mountPerfProbe(engine)` 和 `mountDiag(ui)`。正式构建也挂，不走 `__game`。

### 做了什么

- `src/fx/perfProbe.ts`：预分配 240 格的间隔缓冲，丢掉超过 1000ms 的间隔，满 1 秒发一次采样。fps 用间隔中位数，worstMs 用 95 分位。`calls` / `triangles` 读上一帧 `renderer.info.render`（主场景 + 1 次 blit，不含阴影遍）。显卡名只取一次。
- `src/ui/diag/`：左下角面板，`?diag=1` 直接显示；设置里的「性能信息」调用 `toggleDiag()`。不发 `ui:modal`。按钮以外不接指针（文本框除外，方便复制失败时手动选中）。触屏时面板抬到摇杆上方。
- 「跑一遍测试」在首次 `map:loaded` 后 6 秒内禁用。三档都用 `updateSettings(..., 'auto')`：像素风高、高清高、像素风低。每档等 1.5 秒再收 4 个采样取中位数。结束时把内存设置整份写回，并把 `localStorage['ai-travel:settings']` 恢复成测试前的原文（没有存档就删掉测试期间写出的那条）。

### 验证

- `npm run typecheck` 通过。`npm run shots` 九张 0.00%，`CONSOLE_ERRORS 0`。
- 开发模式 `/?diag=1&autoquality=0`：面板可见，帧率文本为正数；跑完测试 JSON 有 3 行（`640x400@2`、`1280x800@1`、`640x400@2`），存档原文不变。不带 `?diag=1` 时面板不可见。
- `npm run build && npm run preview`：`window.__game` 为 undefined，同一套测试仍可用，控制台 0 错误。
- 1280×800 出生点、`?autoquality=0`、主场景绘制（不含阴影遍）：东京 119 / 21417，吉萨 79 / 17529，巴黎 117 / 18869。和 R1-6 同一量级（东京少 2 次，是视锥里少看到一点，不是这张面板画进场景）。swiftshader 下像素风高约 25fps，高清高约 6fps，像素风低顶到 60。
