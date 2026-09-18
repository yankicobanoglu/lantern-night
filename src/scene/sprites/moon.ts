import { PixelBuffer } from '../../engine/pixelBuffer';
import { PALETTE } from '../../palette';
import type { MoonFrame } from '../../ritual/moonPhase';

export const MOON_SIZE = 32;
/** A supermoon (ROADMAP 4.6) is drawn a little larger, on the same pixel grid. */
export const SUPERMOON_SIZE = 36;

/**
 * Build the pixel map for a phase frame (0 new … 4 full … 7 waning crescent)
 * on a `size`×`size` grid (32 by default, 36 for a supermoon).
 *
 * For a sphere lit from the side, every horizontal chord of the disc has the same
 * lit fraction, (1 − cos θ) / 2. So each row lights that fraction of its disc
 * pixels, from the right while waxing and from the left while waning. Rounding a
 * monotone sequence stays monotone, so the terminator has no one-pixel bumps.
 * The unlit part is always earthshine, so the whole disc reads in every phase.
 * At the widest row the thinnest crescent (frames 1 and 7) is 4 art px.
 */
export function moonPixelMap(frame: MoonFrame, size = MOON_SIZE): string[] {
  const centre = size / 2;
  const radius = centre - 0.5;
  const age = frame / 8;
  const waxing = age < 0.5;
  const litFraction = frame === 0 ? 0 : frame === 4 ? 1 : (1 - Math.cos(age * Math.PI * 2)) / 2;
  const rows: string[] = [];
  for (let py = 0; py < size; py++) {
    const dy = py + 0.5 - centre;
    const inside = radius * radius - dy * dy;
    if (inside <= 0) {
      rows.push('.'.repeat(size));
      continue;
    }
    const halfW = Math.sqrt(inside);
    const x0 = Math.floor(centre - halfW + 0.5);
    const x1 = Math.ceil(centre + halfW - 0.5); // exclusive
    const discW = Math.max(0, x1 - x0);
    const lit = Math.round(discW * litFraction);
    let row = '.'.repeat(x0);
    for (let i = 0; i < discW; i++) {
      const isLit = waxing ? i >= discW - lit : i < lit;
      row += isLit ? 'm' : 'e';
    }
    row += '.'.repeat(size - row.length);
    rows.push(row);
  }
  return rows;
}

export const MOON_MAP_PALETTE = { m: PALETTE.moon, e: PALETTE.earthshine } as const;

export function moonBuffer(frame: MoonFrame, size = MOON_SIZE): PixelBuffer {
  const buf = new PixelBuffer(size, size);
  buf.blit(moonPixelMap(frame, size), MOON_MAP_PALETTE, 0, 0);
  return buf;
}

/** Width in art px of the lit part at the widest row. Used by tests and the squint check. */
export function litWidthAtEquator(frame: MoonFrame, size = MOON_SIZE): number {
  const row = moonPixelMap(frame, size)[size / 2] ?? '';
  return (row.match(/m/g) ?? []).length;
}
