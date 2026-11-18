/**
 * 触屏最小闭环：iPhone 14 横屏视口。
 * 摇杆推动后玩家位置变化，拖动视角后 yaw 变化，护照按钮打开弹窗。
 *
 *   node tools/touch-smoke.mjs
 * 需要开发服务器（默认 http://localhost:5173）。
 */
import { chromium, devices } from 'playwright';

const base = (process.env.SHOTS_URL ?? 'http://localhost:5173').replace(/\/$/, '').replace(/\?.*$/, '');
const phone = devices['iPhone 14'];

async function touch(client, type, points) {
  await client.send('Input.dispatchTouchEvent', {
    type,
    touchPoints: points.map((p) => ({ x: Math.round(p.x), y: Math.round(p.y), id: p.id ?? 1 })),
  });
}

const browser = await chromium.launch({
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const context = await browser.newContext({
  userAgent: phone.userAgent,
  viewport: { width: phone.viewport.height, height: phone.viewport.width },
  deviceScaleFactor: 1,
  isMobile: true,
  hasTouch: true,
});
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text());
});

try {
  await page.goto(`${base}/?autoquality=0`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__game?.world?.current && document.querySelector('.touch-layer'), null, {
    timeout: 20000,
  });
  // 开局护照是开着的，先用屏幕上的护照键合上（走 KeyM 路由）
  const passBtn = page.locator('.touch-menu button', { hasText: '护照' });
  await passBtn.tap();
  await page.waitForFunction(() => window.__game.modals.isOpen('passport') === false, null, { timeout: 3000 });
  const probe = await page.evaluate(() => ({
    coarse: window.matchMedia('(pointer: coarse)').matches,
    touch: navigator.maxTouchPoints,
  }));
  if (!probe.coarse) throw new Error(`iPhone 视口没有匹配 pointer: coarse（maxTouchPoints=${probe.touch}）`);

  const stick = await page.locator('[data-stick]').boundingBox();
  if (!stick) throw new Error('找不到摇杆');
  const before = await page.evaluate(() => {
    const p = window.__game.player.position;
    return { x: p.x, z: p.z, yaw: window.__game.player.cam.yaw };
  });
  const client = await context.newCDPSession(page);
  const cx = stick.x + stick.width / 2;
  const cy = stick.y + stick.height / 2;
  await touch(client, 'touchStart', [{ x: cx, y: cy - 36 }]);
  await page.waitForTimeout(700);
  await touch(client, 'touchEnd', []);
  const moved = await page.evaluate(() => {
    const p = window.__game.player.position;
    return { x: p.x, z: p.z };
  });
  const dist = Math.hypot(moved.x - before.x, moved.z - before.z);
  if (dist < 0.35) throw new Error(`摇杆没有推动玩家，位移 ${dist.toFixed(3)}`);

  const look = await page.locator('.touch-look').boundingBox();
  if (!look) throw new Error('找不到视角区');
  const x0 = look.x + look.width * 0.55;
  const y0 = look.y + look.height * 0.45;
  await touch(client, 'touchStart', [{ x: x0, y: y0 }]);
  for (let i = 1; i <= 6; i++) {
    await touch(client, 'touchMove', [{ x: x0 + i * 18, y: y0 }]);
    await page.waitForTimeout(30);
  }
  await touch(client, 'touchEnd', []);
  await page.waitForTimeout(100);
  const yaw = await page.evaluate(() => window.__game.player.cam.yaw);
  if (Math.abs(yaw - before.yaw) < 0.02) throw new Error(`视角没有变化 yaw ${before.yaw} → ${yaw}`);

  const locked = await page.evaluate(() => window.__game.engine.input.locked);
  if (locked) throw new Error('触屏上不应该进入 pointer lock');

  await passBtn.tap();
  await page.waitForFunction(() => window.__game.modals.isOpen('passport'), null, { timeout: 3000 });

  if (errors.length) throw new Error(errors.join(' | '));
  console.log(
    `touch-smoke: move ${dist.toFixed(2)}m, yaw ${before.yaw.toFixed(3)} → ${yaw.toFixed(3)}, passport open, coarse=${probe.coarse}`,
  );
} finally {
  await browser.close();
}
