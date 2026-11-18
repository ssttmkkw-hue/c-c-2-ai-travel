/**
 * UI 整体缩放：让像素字体的每个「字体像素」正好落在整数个屏幕物理像素上。
 *
 * Fusion Pixel 是 12px 点阵字体，只有渲染成 12 / 24 / 36… 个物理像素高时才是清晰的。
 * 样式表里字号统一写 12px 或 24px（CSS 像素），但 CSS 像素 ≠ 物理像素：
 * Windows 缩放 125% / 150%、浏览器缩放 110% 时，12 CSS 像素 = 15 / 18 / 13.2 物理像素，字就糊了。
 *
 * 做法：给 #ui 设 CSS zoom = n / devicePixelRatio，n 是整数（1 个 CSS 像素 = n 个物理像素），
 * 于是 12px 的字 = 12n 物理像素，边框、间距也都是整数物理像素。
 * n 的选法：屏幕越大 n 越大（1080p → 2，4K → 4），保证缩放后的布局空间短边仍有 540 以上；
 * 同时不让字小于约 0.8 倍 CSS 字号（手机 DPR 3 时 n = 3，和不缩放一样）。
 *
 * 注意：#ui 里用 JS 算的像素坐标（如 NPC 气泡）要除以 uiZoom()。
 */

/** 缩放后布局空间的最小短边 / 最小宽度（CSS 像素）。大于这个才放大一级 */
const MIN_LAYOUT_SHORT = 540;
const MIN_LAYOUT_WIDTH = 720;
/** 相对 CSS 像素最多缩小到这个比例（125% 缩放的小窗口会用到 0.8） */
const MIN_ZOOM = 0.8;

let zoom = 1;

/** 当前 #ui 的缩放倍数（#ui 内 1px = uiZoom() 个视口 CSS 像素） */
export function uiZoom(): number {
  return zoom;
}

export function computeUiZoom(cssWidth: number, cssHeight: number, dpr: number): number {
  const physW = cssWidth * dpr;
  const physShort = Math.min(cssWidth, cssHeight) * dpr;
  const bySize = Math.min(Math.floor(physShort / MIN_LAYOUT_SHORT), Math.floor(physW / MIN_LAYOUT_WIDTH));
  const byReadability = Math.ceil(dpr * MIN_ZOOM - 1e-6);
  const n = Math.max(1, bySize, byReadability);
  return n / dpr;
}

export function mountUiScale(root: HTMLElement): void {
  const apply = () => {
    const next = computeUiZoom(window.innerWidth, window.innerHeight, window.devicePixelRatio || 1);
    if (next === zoom && root.style.zoom) return;
    zoom = next;
    root.style.zoom = String(zoom);
  };
  apply();
  // 浏览器缩放、把窗口拖到另一块屏幕时 devicePixelRatio 会变，同时也会触发 resize
  window.addEventListener('resize', apply);
}
