/**
 * 只读性能探针：每帧记间隔，满 1 秒发一次 perf:sample。
 * 不改画质、不改场景。和 fx/particles 一样由 main 传入 Engine。
 */
import type { Engine } from '@/core/Engine';
import { bus } from '@/core/events';

const RING = 240;
/** 切后台或调试器暂停，和 autoQuality 的 MAX_GAP_MS 同一口径 */
const MAX_GAP_MS = 1000;
const WINDOW_MS = 1000;

export function mountPerfProbe(engine: Engine): void {
  const gaps = new Float32Array(RING);
  const sorted = new Float32Array(RING);
  let count = 0;
  let acc = 0;
  let last = performance.now();
  let gpu = '';

  engine.onUpdate(() => {
    const now = performance.now();
    const gap = now - last;
    last = now;
    if (gap > MAX_GAP_MS) return;
    if (count < RING) gaps[count++] = gap;
    acc += gap;
    if (acc < WINDOW_MS || count === 0) return;

    insertSort(gaps, count, sorted);
    const mid = median(sorted, count);
    const p95 = sorted[Math.min(count - 1, Math.max(0, Math.ceil(count * 0.95) - 1))];
    const info = engine.renderer.info.render;
    if (!gpu) gpu = readGpu(engine);
    bus.emit('perf:sample', {
      fps: mid > 0 ? 1000 / mid : 0,
      worstMs: p95,
      calls: info.calls,
      triangles: info.triangles,
      gpu,
    });
    count = 0;
    acc = 0;
  });
}

function readGpu(engine: Engine): string {
  const gl = engine.renderer.getContext();
  const ext = gl.getExtension('WEBGL_debug_renderer_info') as { UNMASKED_RENDERER_WEBGL: number } | null;
  if (!ext) return '未知';
  const name = gl.getParameter(ext.UNMASKED_RENDERER_WEBGL);
  return typeof name === 'string' && name.length > 0 ? name : '未知';
}

function insertSort(src: Float32Array, n: number, dst: Float32Array): void {
  for (let i = 0; i < n; i++) dst[i] = src[i];
  for (let i = 1; i < n; i++) {
    const v = dst[i];
    let j = i - 1;
    while (j >= 0 && dst[j] > v) {
      dst[j + 1] = dst[j];
      j--;
    }
    dst[j + 1] = v;
  }
}

function median(sorted: Float32Array, n: number): number {
  const mid = n >> 1;
  if (n % 2 === 1) return sorted[mid];
  return (sorted[mid - 1] + sorted[mid]) / 2;
}
