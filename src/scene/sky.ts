import type { PixelBuffer } from '../engine/pixelBuffer';
import type { Layout } from '../engine/layout';
import { createRng } from '../engine/rng';
import { PALETTE, SKY_BANDS, type PaletteKey } from '../palette';

export type Star = { x: number; y: number; big: boolean };

/** Relative heights of the 8 bands, top to horizon: deep night is tallest, the glow is thin. */
const BAND_WEIGHTS = [3, 2.4, 2, 1.6, 1.3, 1, 0.8, 0.7];
const DITHER_ROWS = 2;

const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));

/**
 * Session light arc (SPEC section 3, P1): over the evening the three warm
 * bands give up their height one after another (apricot first, then blush,
 * then rose) and the night band at the top grows by the same amount. The sky
 * stays flat bands with dithered edges; only the heights move.
 */
export function bandWeights(evening = 0): number[] {
  const e = clamp01(evening);
  const w = [...BAND_WEIGHTS];
  const fade = (i: number, from: number): void => {
    const lost = (w[i] ?? 0) * clamp01((e - from) * 3);
    w[i] = (w[i] ?? 0) - lost;
    w[0] = (w[0] ?? 0) + lost;
  };
  fade(7, 0);
  fade(6, 1 / 3);
  fade(5, 2 / 3);
  return w;
}

/** Row where each band starts, plus the horizon as the final entry. */
export function bandBoundaries(horizon: number, evening = 0): number[] {
  const weights = bandWeights(evening);
  const total = weights.reduce((a, b) => a + b, 0);
  const bounds = [0];
  let acc = 0;
  for (const w of weights) {
    acc += w;
    bounds.push(Math.round((acc / total) * horizon));
  }
  return bounds;
}

/** The lowest band with any height left: apricot → blush → rose → plum over the arc. */
export function horizonColour(evening = 0): PaletteKey {
  const weights = bandWeights(evening);
  for (let i = weights.length - 1; i >= 0; i--) if ((weights[i] ?? 0) > 1e-6) return SKY_BANDS[i] ?? 'night';
  return 'night';
}

/** Flat bands with 2-px checker dithering at every edge between bands that still have height. */
export function drawSkyBands(buf: PixelBuffer, layout: Layout, evening = 0): void {
  const { width, horizon } = layout;
  const bounds = bandBoundaries(horizon, evening);
  const bands: { colour: number; y0: number; y1: number; i: number }[] = [];
  for (let i = 0; i < SKY_BANDS.length; i++) {
    const y0 = bounds[i] ?? 0;
    const y1 = bounds[i + 1] ?? horizon;
    if (y1 <= y0) continue;
    const colour = PALETTE[SKY_BANDS[i] ?? 'night'];
    buf.fillRect(0, y0, width, y1 - y0, colour);
    bands.push({ colour, y0, y1, i });
  }
  for (let k = 1; k < bands.length; k++) {
    const upper = bands[k - 1]!;
    const lower = bands[k]!;
    buf.checker(0, width, lower.y0 - DITHER_ROWS, lower.y0 + DITHER_ROWS, upper.colour, lower.colour, 2, lower.i);
  }
}

/**
 * Stars: cool white, 1 px, a few 2×2. Denser at the top, none in the glow
 * bands. Laid out for evening 0 so the set never changes under you.
 */
export function drawStars(buf: PixelBuffer, layout: Layout, seed: number): Star[] {
  const { width, horizon } = layout;
  const bounds = bandBoundaries(horizon, 0);
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

export function drawSky(buf: PixelBuffer, layout: Layout, seed: number, evening = 0): Star[] {
  drawSkyBands(buf, layout, evening);
  return drawStars(buf, layout, seed);
}
