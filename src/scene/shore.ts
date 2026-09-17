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
  // Grass texture: sparse lighter blades on the first rows of ground.
  for (let x = 0; x < width; x++) {
    for (let y = top; y < top + 5; y++) {
      if (hash01(x * 131 + y, seed + 72) < 0.16) buf.set(x, y, PALETTE.nearHills);
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
