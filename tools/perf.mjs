/**
 * 固定镜头 + freezeVisual，量软件渲染下的帧率。
 * 三张图 × 画质低/中/高（像素颗粒精细），再加一组像素颗粒复古（画质高）。
 * 每格 3 次，取 fps 中位数。draw call 不含阴影遍。
 *
 *   npm run perf
 *   node tools/perf.mjs
 *
 * 需要开发服务器（默认 http://localhost:5173，可用 SHOTS_URL 改）。
 * 结果打到 stdout，并写 tools/perf-last.json（gitignore，本地记录）。
 */
import { chromium } from 'playwright';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const base = (process.env.SHOTS_URL ?? 'http://localhost:5173').replace(/\/$/, '').replace(/\?.*$/, '');
const SAMPLE_MS = 1200;
const SAMPLES = 3;

const MAPS = [
  { id: 'tokyo', x: 0, z: 22, yaw: 0, distance: 8, pitch: -0.32 },
  { id: 'egypt', x: 0, z: 16, yaw: 0, distance: 9, pitch: -0.22 },
  { id: 'paris', x: 0, z: 8, yaw: 0, distance: 9, pitch: -0.18 },
];

/** 画质三档用精细颗粒；再单列一档复古颗粒（填充率真正会降的那一档） */
const CONFIGS = [
  { quality: 'low', pixelDensity: 'fine' },
  { quality: 'medium', pixelDensity: 'fine' },
  { quality: 'high', pixelDensity: 'fine' },
  { quality: 'high', pixelDensity: 'coarse' },
];

function median(values) {
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

const browser = await chromium.launch({
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 })).newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text());
});

await page.goto(`${base}/?autoquality=0`, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__game?.engine?.freezeVisual, null, { timeout: 20000 });

const rows = [];
for (const config of CONFIGS) {
  // 写进存档再刷新。页面里动态 import 会拿到另一份 settings 模块，改了引擎也看不见。
  await page.evaluate((config) => {
    const prev = JSON.parse(localStorage.getItem('ai-travel:settings') || '{}');
    localStorage.setItem(
      'ai-travel:settings',
      JSON.stringify({
        renderMode: 'pixel',
        outline: true,
        mouseSensitivity: 1,
        autoQuality: false,
        qualityManual: true,
        autoQualityDone: true,
        ...prev,
        quality: config.quality,
        pixelDensity: config.pixelDensity,
      }),
    );
  }, config);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__game?.engine?.freezeVisual, null, { timeout: 20000 });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  for (const map of MAPS) {
    await page.evaluate(async (map) => {
      const g = window.__game;
      g.engine.freezeVisual(1.5);
      if (g.world.current?.id !== map.id) {
        await new Promise((resolve, reject) => {
          const timer = window.setTimeout(() => reject(new Error(`地图 ${map.id} 加载超时`)), 15000);
          const off = g.bus.on('map:loaded', ({ card }) => {
            if (card.id !== map.id) return;
            window.clearTimeout(timer);
            off();
            resolve();
          });
          g.bus.emit('map:request', { id: map.id });
        });
      }
      g.engine.freezeVisual(1.5);
      g.world.setTimeOfDay(null, 0);
      g.player.teleport(map.x, map.z, map.yaw);
      Object.assign(g.player.cam, { yaw: map.yaw, distance: map.distance, pitch: map.pitch, mode: 'third' });
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    }, map);
    const samples = [];
    for (let i = 0; i < SAMPLES; i++) {
      const fps = await page.evaluate(
        (ms) =>
          new Promise((resolve) => {
            let frames = 0;
            const t0 = performance.now();
            const tick = (now) => {
              frames++;
              if (now - t0 < ms) requestAnimationFrame(tick);
              else resolve(frames / ((now - t0) / 1000));
            };
            requestAnimationFrame(tick);
          }),
        SAMPLE_MS,
      );
      samples.push(fps);
    }
    const info = await page.evaluate(() => {
      const r = window.__game.engine.renderer.info.render;
      const canvas = window.__game.engine.renderer.domElement;
      const view = window.__game.engine.view;
      return {
        calls: r.calls,
        triangles: r.triangles,
        canvas: [canvas.width, canvas.height],
        view: [view.width, view.height],
        scale: view.scale,
      };
    });
    const row = {
      map: map.id,
      quality: config.quality,
      pixelDensity: config.pixelDensity,
      fpsMedian: Math.round(median(samples) * 10) / 10,
      fpsSamples: samples.map((n) => Math.round(n * 10) / 10),
      calls: info.calls,
      triangles: info.triangles,
      canvas: info.canvas,
      view: info.view,
      scale: info.scale,
    };
    rows.push(row);
    console.log(
      `${row.map} ${row.quality}/${row.pixelDensity} fps ${row.fpsMedian} calls ${row.calls} tris ${row.triangles} canvas ${row.canvas.join('x')} view ${row.view.join('x')} x${row.scale}`,
    );
  }
}

const report = {
  at: new Date().toISOString(),
  viewport: [1280, 800],
  renderer: 'swiftshader',
  sampleMs: SAMPLE_MS,
  samples: SAMPLES,
  note: 'fps 是 requestAnimationFrame 计数，软件渲染，只能看相对值。calls 不含阴影遍。',
  rows,
  consoleErrors: errors,
};
const json = JSON.stringify(report, null, 2);
console.log(json);
await writeFile(path.join(root, 'tools/perf-last.json'), json);
await browser.close();
if (errors.length) process.exitCode = 1;
