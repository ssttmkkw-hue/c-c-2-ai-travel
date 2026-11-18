/**
 * 后台与上下文：visibilitychange 清掉虚拟输入；
 * WEBGL_lose_context 丢失再恢复后画面还在，控制台没有 error。
 *
 *   node tools/context-restore.mjs
 */
import { chromium } from 'playwright';

const base = (process.env.SHOTS_URL ?? 'http://localhost:5173').replace(/\/$/, '').replace(/\?.*$/, '');

const browser = await chromium.launch({
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on('pageerror', (e) => errors.push(`PAGE ${e.message}`));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text());
});

try {
  await page.goto(`${base}/?autoquality=0`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__game?.engine, null, { timeout: 20000 });
  await page.waitForTimeout(600);

  const keys = await page.evaluate(() => {
    const input = window.__game.engine.input;
    input.setVirtualMove(0, 1);
    const before = input.isDown('KeyW');
    document.dispatchEvent(new Event('visibilitychange'));
    return { before, after: input.isDown('KeyW') };
  });
  if (!keys.before || keys.after) {
    throw new Error(`visibilitychange 没有清掉虚拟移动 before=${keys.before} after=${keys.after}`);
  }

  await page.evaluate(() => {
    const ui = document.getElementById('ui');
    if (ui) ui.style.visibility = 'hidden';
  });

  const lost = await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    const ext = gl?.getExtension('WEBGL_lose_context');
    if (!ext) return 'no-ext';
    ext.loseContext();
    window.__loseExt = ext;
    return 'lost';
  });
  if (lost !== 'lost') throw new Error(`拿不到 WEBGL_lose_context（${lost}）`);
  await page.waitForTimeout(300);
  await page.evaluate(() => window.__loseExt.restoreContext());
  await page.waitForTimeout(800);

  const png = await page.screenshot({ type: 'png' });
  const lit = await page.evaluate(async (b64) => {
    const img = new Image();
    img.src = `data:image/png;base64,${b64}`;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.width;
    c.height = img.height;
    const ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0);
    const data = ctx.getImageData(0, 0, c.width, c.height).data;
    let n = 0;
    const step = 16 * 4;
    for (let i = 0; i < data.length; i += step) {
      if (data[i] + data[i + 1] + data[i + 2] > 40) n++;
    }
    return n;
  }, png.toString('base64'));

  if (errors.length) throw new Error(errors.join(' | '));
  if (lit < 50) throw new Error(`恢复后画面几乎是黑的（抽样亮点 ${lit}）`);
  console.log(`context-restore: 虚拟输入已清，恢复后抽样亮点 ${lit}，无控制台 error`);
} finally {
  await browser.close();
}
