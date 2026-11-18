/**
 * 视觉回归：固定镜头 + 冻结模拟时间，和 tools/baseline/ 逐像素比对。
 *
 *   npm run shots
 *   node tools/visual-check.mjs --update
 *
 * 需要开发服务器已在 http://localhost:5173（可用 SHOTS_URL 改）。
 * 差异图写到 tools/diff/（gitignore）。比对在页面里用 canvas 完成，不另加图像库。
 */
import { chromium } from 'playwright';
import { mkdir, readFile, writeFile, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const baselineDir = path.join(root, 'tools/baseline');
const diffDir = path.join(root, 'tools/diff');
const update = process.argv.includes('--update');
const baseUrl = process.env.SHOTS_URL ?? 'http://localhost:5173/?autoquality=0';

/** 640×400：和默认像素风内部分辨率同一量级，PNG 也能保持很小 */
const WIDTH = 640;
const HEIGHT = 400;
const FREEZE_AT = 1.5;
/** 单通道差过这个值才算不同像素 */
const CHANNEL = 18;
/** 不同像素占比超过这个值则失败 */
const MAX_RATIO = 0.015;

const VIEWS = [
  { id: 'tokyo', x: 0, z: 22, yaw: 0, distance: 8, pitch: -0.32 },
  { id: 'egypt', x: 0, z: 16, yaw: 0, distance: 9, pitch: -0.22 },
  { id: 'paris', x: 0, z: 8, yaw: 0, distance: 9, pitch: -0.18 },
];

async function exists(file) {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

async function shoot(page, view) {
  await page.evaluate(async (v) => {
    const g = window.__game;
    if (!g?.engine?.freezeVisual) throw new Error('开发模式的 __game.engine.freezeVisual 不存在');
    g.engine.freezeVisual(v.freezeAt);
    const ui = document.getElementById('ui');
    if (ui) ui.style.visibility = 'hidden';
    if (g.world.current?.id !== v.id) {
      await new Promise((resolve, reject) => {
        const timer = window.setTimeout(() => reject(new Error(`地图 ${v.id} 加载超时`)), 15000);
        const off = g.bus.on('map:loaded', ({ card }) => {
          if (card.id !== v.id) return;
          window.clearTimeout(timer);
          off();
          resolve();
        });
        g.bus.emit('map:request', { id: v.id });
      });
    }
    g.engine.freezeVisual(v.freezeAt);
    g.player.teleport(v.x, v.z, v.yaw);
    Object.assign(g.player.cam, { yaw: v.yaw, distance: v.distance, pitch: v.pitch, mode: 'third' });
    await new Promise((r) => {
      requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(r)));
    });
  }, { ...view, freezeAt: FREEZE_AT });
  await page.waitForTimeout(350);
  const buf = await page.screenshot({ type: 'png' });
  return buf;
}

/** 在页面 canvas 里比对两张 PNG，返回不同像素占比和差异图（base64，无前缀） */
async function diffInPage(page, baseline, actual) {
  return page.evaluate(async ({ a, b, channel }) => {
    function load(b64) {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          ctx.drawImage(img, 0, 0);
          resolve(ctx.getImageData(0, 0, canvas.width, canvas.height));
        };
        img.onerror = () => reject(new Error('PNG 解码失败'));
        img.src = `data:image/png;base64,${b64}`;
      });
    }
    const A = await load(a);
    const B = await load(b);
    if (A.width !== B.width || A.height !== B.height) {
      return { mismatch: true, message: `尺寸 ${A.width}×${A.height} 对 ${B.width}×${B.height}` };
    }
    const w = A.width;
    const h = A.height;
    const out = new Uint8ClampedArray(w * h * 4);
    let diff = 0;
    for (let i = 0; i < A.data.length; i += 4) {
      const d = Math.max(
        Math.abs(A.data[i] - B.data[i]),
        Math.abs(A.data[i + 1] - B.data[i + 1]),
        Math.abs(A.data[i + 2] - B.data[i + 2]),
      );
      if (d > channel) {
        diff++;
        out[i] = 255;
        out[i + 1] = 0;
        out[i + 2] = 96;
        out[i + 3] = 255;
      } else {
        out[i + 3] = 255;
      }
    }
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    canvas.getContext('2d').putImageData(new ImageData(out, w, h), 0, 0);
    const url = canvas.toDataURL('image/png');
    return { mismatch: false, diff, total: w * h, png: url.slice(url.indexOf(',') + 1) };
  }, { a: baseline.toString('base64'), b: actual.toString('base64'), channel: CHANNEL });
}

const browser = await chromium.launch({
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const context = await browser.newContext({ viewport: { width: WIDTH, height: HEIGHT }, deviceScaleFactor: 1 });
const page = await context.newPage();
const issues = [];
page.on('console', (m) => { if (m.type() === 'error') issues.push(m.text()); });
page.on('pageerror', (e) => issues.push(`PAGEERROR ${e.message}`));
await page.addInitScript((freezeAt) => {
  const tick = () => {
    const engine = window.__game?.engine;
    if (engine?.freezeVisual) engine.freezeVisual(freezeAt);
    else requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}, FREEZE_AT);
await page.goto(baseUrl, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__game?.world, null, { timeout: 20000 });
await page.waitForTimeout(800);

await mkdir(baselineDir, { recursive: true });
await mkdir(diffDir, { recursive: true });

let failed = 0;
for (const view of VIEWS) {
  const actual = await shoot(page, view);
  const file = path.join(baselineDir, `${view.id}.png`);
  if (update || !(await exists(file))) {
    await writeFile(file, actual);
    console.log(update ? '更新' : '新建', path.relative(root, file), `${(actual.length / 1024).toFixed(0)} KB`);
    continue;
  }
  const baseline = await readFile(file);
  const result = await diffInPage(page, baseline, actual);
  if (result.mismatch) {
    failed++;
    console.log(view.id, '失败', result.message);
    continue;
  }
  const ratio = result.diff / result.total;
  const ok = ratio <= MAX_RATIO;
  if (!ok) failed++;
  console.log(`${view.id} 不同像素 ${(ratio * 100).toFixed(2)}%（${result.diff}/${result.total}）${ok ? ' 通过' : ' 失败'}`);
  if (!ok) {
    const diffPath = path.join(diffDir, `${view.id}.png`);
    await writeFile(diffPath, Buffer.from(result.png, 'base64'));
    console.log('  差异图', path.relative(root, diffPath));
  }
}

console.log('CONSOLE_ERRORS', issues.length);
for (const line of issues) console.log(' ', line);
await browser.close();
if (!update && failed) process.exitCode = 1;
if (issues.length) process.exitCode = 1;
