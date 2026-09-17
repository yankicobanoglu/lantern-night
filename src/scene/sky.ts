import type { PixelBuffer } from '../engine/pixelBuffer';
import type { Layout } from '../engine/layout';
import { createRng } from '../engine/rng';
import { PALETTE, SKY_BANDS } from '../palette';

export type Star = { x: number; y: number; big: boolean };

/** Relative heights of the 8 bands, top to horizon: deep night is tallest, the glow is thin. */
const BAND_WEIGHTS = [3, 2.4, 2, 1.6, 1.3, 1, 0.8, 0.7];
const DITHER_ROWS = 2;

/** Row where each band starts, plus the horizon as the final entry. */
export function bandBoundaries(horizon: number): number[] {
  const total = BAND_WEIGHTS.reduce((a, b) => a + b, 0);
  const bounds = [0];
  let acc = 0;
  for (const w of BAND_WEIGHTS) {
    acc += w;
    bounds.push(Math.round((acc / total) * horizon));
  }
  return bounds;
}

export function drawSky(buf: PixelBuffer, layout: Layout, seed: number): Star[] {
  const { width, horizon } = layout;
  const bounds = bandBoundaries(horizon);

  for (let i = 0; i < SKY_BANDS.length; i++) {
    const colour = PALETTE[SKY_BANDS[i] ?? 'night'];
    const y0 = bounds[i] ?? 0;
    const y1 = bounds[i + 1] ?? horizon;
    buf.fillRect(0, y0, width, y1 - y0, colour);
  }
  // 2-px checker dithering straddling each band edge.
  for (let i = 1; i < SKY_BANDS.length; i++) {
    const upper = PALETTE[SKY_BANDS[i - 1] ?? 'night'];
    const lower = PALETTE[SKY_BANDS[i] ?? 'night'];
    const edge = bounds[i] ?? 0;
    buf.checker(0, width, edge - DITHER_ROWS, edge + DITHER_ROWS, upper, lower, 2, i);
  }

  // Stars: cool white, 1 px, a few 2×2. Denser at the top, none in the glow bands.
  const rng = createRng(seed);
  const stars: Star[] = [];
  const starLimitY = bounds[5] ?? horizon; // stop above the rose band
  const count = Math.round((width * starLimitY) / 300);
  const moonR2 = 20 * 20;
  for (let i = 0; i < count; i++) {
    const x = rng.int(0, width - 2);
    // Bias upward: square the random so more stars land high.
    const y = Math.floor(rng.next() ** 1.6 * starLimitY);
    const dx = x - layout.moon.x;
    const dy = y - layout.moon.y;
    if (dx * dx + dy * dy < moonR2) continue;
    const big = rng.next() < 0.06 && y < (bounds[3] ?? horizon);
    stars.push({ x, y, big });
    buf.set(x, y, PALETTE.star);
    if (big) {
      buf.set(x + 1, y, PALETTE.star);
      buf.set(x, y + 1, PALETTE.star);
      buf.set(x + 1, y + 1, PALETTE.star);
    }
  }
  return stars;
}
