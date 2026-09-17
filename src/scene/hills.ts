import type { PixelBuffer } from '../engine/pixelBuffer';
import type { Layout } from '../engine/layout';
import { ridgeNoise } from '../engine/noise';
import { hash01 } from '../engine/rng';
import { PALETTE } from '../palette';
import { COTTAGE_A, COTTAGE_B, COTTAGE_CHIMNEYS, COTTAGE_PALETTE, COTTAGE_WINDOWS } from './sprites/cottage';
import { PINES, PINE_PALETTE } from './sprites/pine';

export type Window = { x: number; y: number; w: number; h: number };
export type Chimney = { x: number; y: number };
export type HillFeatures = { windows: Window[]; chimneys: Chimney[] };

export function farTop(x: number, layout: Layout, seed: number): number {
  return layout.horizon - 3 - Math.round(13 * ridgeNoise(x / 26 + seed, 11));
}

export function nearTop(x: number, layout: Layout, seed: number): number {
  return layout.horizon + 10 + Math.round(13 * ridgeNoise(x / 17 + seed * 1.7, 23));
}

export function drawHills(buf: PixelBuffer, layout: Layout, seed: number): HillFeatures {
  const { width, hillsEnd } = layout;
  const windows: Window[] = [];
  const chimneys: Chimney[] = [];

  // Far hills, silhouetted against the horizon glow.
  for (let x = 0; x < width; x++) buf.vline(x, farTop(x, layout, seed), hillsEnd, PALETTE.farHills);

  // Two cottages on the far ridge, each with one lit window.
  const cottages = [
    { map: COTTAGE_A, wins: COTTAGE_WINDOWS.a, chimney: COTTAGE_CHIMNEYS.a, fx: layout.landscape ? 0.2 : 0.22 },
    { map: COTTAGE_B, wins: COTTAGE_WINDOWS.b, chimney: COTTAGE_CHIMNEYS.b, fx: layout.landscape ? 0.62 : 0.66 },
  ];
  for (const c of cottages) {
    const cw = c.map[0]?.length ?? 0;
    const ch = c.map.length;
    const cx = Math.round(width * c.fx) - Math.floor(cw / 2);
    // Sit on the highest ridge point under the cottage so it never floats.
    let ground = Infinity;
    for (let x = cx; x < cx + cw; x++) ground = Math.min(ground, farTop(x, layout, seed));
    const cy = ground - ch + 2;
    // Ground the cottage: raise the hill under it so no sky shows beneath the walls.
    for (let x = cx; x < cx + cw; x++) buf.vline(x, cy + ch - 1, farTop(x, layout, seed), PALETTE.farHills);
    buf.blit(c.map, COTTAGE_PALETTE, cx, cy);
    for (const w of c.wins) windows.push({ x: cx + w.x, y: cy + w.y, w: w.w, h: w.h });
    chimneys.push({ x: cx + c.chimney.x, y: cy + c.chimney.y - 1 });
  }

  // Near hills.
  for (let x = 0; x < width; x++) buf.vline(x, nearTop(x, layout, seed), hillsEnd, PALETTE.nearHills);

  // Pines along the near ridge, in silhouette.
  let x = 2 + Math.floor(hash01(seed, 5) * 6);
  while (x < width - 2) {
    const pick = hash01(x, seed + 31);
    const map = PINES[Math.floor(pick * PINES.length)] ?? PINES[0]!;
    const pw = map[0]?.length ?? 1;
    const ph = map.length;
    const base = nearTop(x, layout, seed) + 2;
    buf.blit(map, PINE_PALETTE, x - Math.floor(pw / 2), base - ph);
    x += 6 + Math.floor(hash01(x, seed + 47) * 9);
  }

  return { windows, chimneys };
}
