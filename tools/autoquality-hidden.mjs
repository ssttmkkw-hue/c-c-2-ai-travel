/**
 * 自动降档：采样途中把页面藏起来再打开，不应写成 autoQualityDone。
 * 另外在低画质上人为拖慢帧，确认梯子会降一档像素颗粒，且 scale 仍是整数。
 *
 *   node tools/autoquality-hidden.mjs
 * 需要开发服务器（默认 http://localhost:5173，可用 SHOTS_URL 改）。
 */
import { chromium } from 'playwright';

const base = (process.env.SHOTS_URL ?? 'http://localhost:5173').replace(/\/$/, '');
const origin = new URL(base).origin;

const settings = {
  renderMode: 'pixel',
  pixelDensity: 'fine',
  quality: 'high',
  outline: true,
  mouseSensitivity: 1,
  autoQuality: true,
  qualityManual: false,
  autoQualityDone: false,
};

function launch() {
  return chromium.launch({
    args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  });
}

async function seed(page, patch) {
  await page.addInitScript(
    ({ key, value }) => {
      localStorage.setItem(key, JSON.stringify(value));
      localStorage.removeItem('ai-travel:auto-quality-toast');
    },
    { key: 'ai-travel:settings', value: { ...settings, ...patch } },
  );
}

async function waitForGame(page) {
  await page.waitForFunction(() => window.__game?.world?.current?.id, null, { timeout: 20000 });
}

/**
 * 采样开始后暂停 rAF 数秒，再恢复。
 * 恢复的第一帧间隔是数秒；这正是标签页在后台时 rAF 停摆、切回来被算成 0 帧的情况。
 * 同时把 document.hidden 拨过去，覆盖 visibilitychange 那条路径。
 */
async function checkHidden(browser) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(() => {
    const orig = window.requestAnimationFrame.bind(window);
    const queue = new Map();
    let nextId = 1;
    let paused = false;
    let pumpQueued = false;
    const schedulePump = () => {
      if (paused || pumpQueued) return;
      pumpQueued = true;
      orig(() => {
        pumpQueued = false;
        if (paused) return;
        const first = queue.entries().next();
        if (first.done) return;
        const [id, cb] = first.value;
        queue.delete(id);
        cb(performance.now());
        if (queue.size) schedulePump();
      });
    };
    window.requestAnimationFrame = (cb) => {
      const id = nextId++;
      queue.set(id, cb);
      schedulePump();
      return id;
    };
    window.cancelAnimationFrame = (id) => {
      queue.delete(id);
    };
    window.__pauseRaf = (on) => {
      paused = !!on;
      if (!paused) schedulePump();
    };
  });
  await seed(page, { quality: 'high', pixelDensity: 'fine', autoQualityDone: false });
  await page.goto(`${origin}/?`, { waitUntil: 'domcontentloaded' });
  await waitForGame(page);
  // 预热 400ms 之后采样才开始，再留几帧让它挂上 rAF
  await page.waitForTimeout(800);
  await page.evaluate(() => {
    window.__pauseRaf(true);
    const desc = Object.getOwnPropertyDescriptor(Document.prototype, 'hidden');
    const descState = Object.getOwnPropertyDescriptor(Document.prototype, 'visibilityState');
    Object.defineProperty(Document.prototype, 'hidden', { configurable: true, get: () => true });
    Object.defineProperty(Document.prototype, 'visibilityState', { configurable: true, get: () => 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
    window.__restoreVis = () => {
      if (desc) Object.defineProperty(Document.prototype, 'hidden', desc);
      if (descState) Object.defineProperty(Document.prototype, 'visibilityState', descState);
      document.dispatchEvent(new Event('visibilitychange'));
    };
  });
  await page.waitForTimeout(4000);
  const during = await page.evaluate(() => JSON.parse(localStorage.getItem('ai-travel:settings')));
  if (during.autoQualityDone !== false || during.quality !== 'high') {
    throw new Error(`暂停 rAF 期间就写了存档 quality=${during.quality} done=${during.autoQualityDone}`);
  }
  await page.evaluate(() => {
    window.__restoreVis();
    window.__pauseRaf(false);
  });
  // 只等恢复后的几帧。再等满 2.5 秒的话，这台机器会因为真的低于 27 帧而正当降档。
  await page.waitForTimeout(400);
  const after = await page.evaluate(() => JSON.parse(localStorage.getItem('ai-travel:settings')));
  await ctx.close();
  if (errors.length) throw new Error(`隐藏采样时页面报错：${errors.join(' | ')}`);
  if (!after) throw new Error('隐藏采样后读不到存档');
  if (after.autoQualityDone !== false) {
    throw new Error(`后台采样误写了 autoQualityDone=${after.autoQualityDone} quality=${after.quality} density=${after.pixelDensity}`);
  }
  if (after.quality !== 'high' || after.pixelDensity !== 'fine') {
    throw new Error(`后台采样改了设置 quality=${after.quality} density=${after.pixelDensity}`);
  }
  console.log('hidden-tab: 暂停 rAF 4 秒再恢复，autoQualityDone 仍为 false');
}

/** 低画质 + 标准颗粒，主线程每帧空转，迫使中位数低于 27fps，应降到复古。 */
async function checkDensityRung(browser) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(() => {
    const burn = (deadline) => {
      const start = performance.now();
      while (performance.now() - start < 45) {
        /* 把帧间隔拉到 45ms 以上 */
      }
      void deadline;
      requestAnimationFrame(burn);
    };
    requestAnimationFrame(burn);
  });
  await seed(page, { quality: 'low', pixelDensity: 'normal', qualityManual: false, autoQualityDone: false });
  await page.goto(`${origin}/?`, { waitUntil: 'domcontentloaded' });
  await waitForGame(page);
  await page.waitForFunction(
    () => {
      const raw = localStorage.getItem('ai-travel:settings');
      if (!raw) return false;
      const s = JSON.parse(raw);
      return s.autoQualityDone === true && s.pixelDensity === 'coarse';
    },
    null,
    { timeout: 20000 },
  );
  const report = await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('ai-travel:settings'));
    const view = window.__game.engine.view;
    const toast = document.querySelector('.auto-quality-toast')?.textContent ?? '';
    return { s, scale: view.scale, width: view.width, height: view.height, toast };
  });
  await ctx.close();
  if (errors.length) throw new Error(`分辨率档页面报错：${errors.join(' | ')}`);
  if (report.s.quality !== 'low') throw new Error(`画质被改成了 ${report.s.quality}`);
  if (report.s.qualityManual !== false) throw new Error('分辨率档写了 qualityManual');
  if (!Number.isInteger(report.scale) || report.scale < 1) throw new Error(`scale 不是整数：${report.scale}`);
  if (!report.toast.includes('分辨率')) throw new Error(`提示没有提到分辨率：${report.toast}`);
  console.log(
    `density-rung: normal→coarse qualityManual=false scale=${report.scale} view=${report.width}x${report.height} toast=${report.toast}`,
  );
}

const browser = await launch();
try {
  await checkHidden(browser);
  await checkDensityRung(browser);
  console.log('autoquality checks: ok');
} finally {
  await browser.close();
}
