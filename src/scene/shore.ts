import type { PixelBuffer } from '../engine/pixelBuffer';
import type { Layout } from '../engine/layout';
import { hash01 } from '../engine/rng';
import { PALETTE } from '../palette';

/**
 * Foreground, drawn into a buffer covering rows [hillsEnd, height): shore band,
 * reeds and the dock. Rows above the shore stay transparent so the lake shows.
 */
export function drawShore(buf: PixelBuffer, layout: Layout, seed: number): void {
  const { width, hillsEnd, lakeEnd, height, dockX, landscape, dockLen } = layout;
  const top = lakeEnd - hillsEnd; // local row of the shoreline

  // Shore band with a slightly ragged edge.
  for (let x = 0; x < width; x++) {
    const bump = hash01(Math.floor(x / 3), seed + 71) < 0.4 ? -1 : 0;
    buf.vline(x, top + bump, height - hillsEnd, PALETTE.shore);
  }

  // Dock, seen from behind: narrows slightly as it goes out over the water.
  const nearW = landscape ? 22 : 18;
  const farW = nearW - 6;
  const dockTop = top - dockLen;
  for (let i = 0; i < dockLen + 3; i++) {
    const y = dockTop + i;
    const t = Math.min(1, i / dockLen);
    const w = Math.round(farW + (nearW - farW) * t);
    const x0 = dockX - Math.floor(w / 2);
    const gap = i % 4 === 3;
    buf.hline(x0, x0 + w, y, gap ? PALETTE.woodDark : PALETTE.wood);
  }
  // Posts at the far end and midway, dipping into the water.
  const farX0 = dockX - Math.floor(farW / 2);
  for (const px of [farX0, farX0 + farW - 1]) buf.vline(px, dockTop - 2, dockTop + 5, PALETTE.woodDark);
  const midY = dockTop + Math.floor(dockLen / 2);
  const midW = Math.round((farW + nearW) / 2);
  const midX0 = dockX - Math.floor(midW / 2);
  for (const px of [midX0, midX0 + midW - 1]) buf.vline(px, midY - 1, midY + 4, PALETTE.woodDark);

  // Reeds on both sides, away from the dock.
  const reedCount = Math.round(width / 7);
  for (let i = 0; i < reedCount; i++) {
    const side = hash01(i, seed + 90) < 0.5 ? 0 : 1;
    const span = Math.floor(width * 0.32);
    const x = side === 0 ? Math.floor(hash01(i, seed + 91) * span) : width - 1 - Math.floor(hash01(i, seed + 92) * span);
    const h = 3 + Math.floor(hash01(i, seed + 93) * 5);
    const lean = hash01(i, seed + 94) < 0.5 ? -1 : 1;
    buf.vline(x, top - h, top + 1, PALETTE.shore);
    buf.set(x + lean, top - h - 1, PALETTE.shore);
    buf.set(x + lean, top - h - 2, PALETTE.woodDark);
  }
}
