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
