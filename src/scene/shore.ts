import type { PixelBuffer } from '../engine/pixelBuffer';
import type { Layout } from '../engine/layout';
import { hash01 } from '../engine/rng';
import { PALETTE } from '../palette';

/**
 * Foreground, drawn into a buffer covering rows [hillsEnd, height): the shore
 * is ground (grass in two tones, rocks at the water's edge, reeds on both
 * sides). The lantern waits at the centre, so that stays clear.
 */
export function drawShore(buf: PixelBuffer, layout: Layout, seed: number): void {
  const { width, hillsEnd, lakeEnd, height, centreX } = layout;
  const top = lakeEnd - hillsEnd; // local row of the shoreline
  const rows = height - hillsEnd;

  // Ground with a ragged, slightly rising edge.
  for (let x = 0; x < width; x++) {
    const bump = hash01(Math.floor(x / 3), seed + 71) < 0.4 ? -1 : 0;
    buf.vline(x, top + bump, rows, PALETTE.shore);
  }
  // Grass: a lighter fringe along the edge, then tufts all the way down (denser near the water),
  // with a few pebbles and blush flower dots for warmth.
  for (let x = 0; x < width; x++) {
    if (hash01(x, seed + 75) < 0.55) buf.set(x, top + (hash01(x, seed + 76) < 0.5 ? 0 : 1), PALETTE.nearHills);
  }
  const tufts = Math.round((width * (rows - top)) / 14);
  for (let i = 0; i < tufts; i++) {
    const x = Math.floor(hash01(i, seed + 77) * width);
    const depth = hash01(i, seed + 78);
    const y = top + 2 + Math.floor(depth * depth * (rows - top - 4));
    if (Math.abs(x - centreX) < 11 && y < top + 8) continue; // keep the lantern's footing tidy
    const kind = hash01(i, seed + 79);
    if (kind < 0.55) {
      // Tuft: a small V of blades.
      buf.set(x, y, PALETTE.nearHills);
      buf.set(x - 1, y - 1, PALETTE.nearHills);
      buf.set(x + 1, y - 1, PALETTE.nearHills);
      if (kind < 0.2) buf.set(x, y - 2, PALETTE.farHills);
    } else if (kind < 0.8) {
      // Single blade.
      buf.vline(x, y - 1, y + 1, PALETTE.nearHills);
    } else if (kind < 0.95) {
      // Pebble.
      buf.hline(x, x + 2, y, PALETTE.farHills);
    } else {
      // Flower dot on a stem.
      buf.set(x, y, PALETTE.nearHills);
      buf.set(x, y - 1, PALETTE.blush);
    }
  }
  // A few rocks at the water's edge, away from the lantern.
  const rocks = Math.round(width / 40);
  for (let i = 0; i < rocks; i++) {
    const x = Math.floor(hash01(i, seed + 73) * width);
    if (Math.abs(x - centreX) < 16) continue;
    const w = 2 + Math.floor(hash01(i, seed + 74) * 3);
    buf.fillRect(x, top - 1, w, 2, PALETTE.farHills);
    buf.hline(x, x + w - 1, top - 2, PALETTE.farHills);
    buf.set(x, top - 1, PALETTE.nearHills);
  }

  // Reeds on both sides, away from the centre.
  const reedCount = Math.round(width / 7);
  for (let i = 0; i < reedCount; i++) {
    const side = hash01(i, seed + 90) < 0.5 ? 0 : 1;
    const span = Math.floor(width * 0.34);
    const x = side === 0 ? Math.floor(hash01(i, seed + 91) * span) : width - 1 - Math.floor(hash01(i, seed + 92) * span);
    const h = 3 + Math.floor(hash01(i, seed + 93) * 5);
    const lean = hash01(i, seed + 94) < 0.5 ? -1 : 1;
    buf.vline(x, top - h, top + 1, PALETTE.shore);
    buf.set(x + lean, top - h - 1, PALETTE.shore);
    buf.set(x + lean, top - h - 2, PALETTE.woodDark);
  }
}
