import { PixelBuffer } from '../../engine/pixelBuffer';
import { PALETTE } from '../../palette';
import type { MoonFrame } from '../../ritual/moonPhase';

export const MOON_SIZE = 32;
const R = 15.5;
const CENTRE = 16;

/**
 * Build the 32×32 pixel map for a phase frame (0 new … 4 full … 7 waning crescent).
 *
 * For a sphere lit from the side, every horizontal chord of the disc has the same
 * lit fraction, (1 − cos θ) / 2. So each row lights that fraction of its disc
 * pixels, from the right while waxing and from the left while waning. Rounding a
 * monotone sequence stays monotone, so the terminator has no one-pixel bumps.
 * The unlit part is always earthshine, so the whole disc reads in every phase.
 * At the widest row the thinnest crescent (frames 1 and 7) is 4 art px.
 */
export function moonPixelMap(frame: MoonFrame): string[] {
  const age = frame / 8;
  const waxing = age < 0.5;
  const litFraction = frame === 0 ? 0 : frame === 4 ? 1 : (1 - Math.cos(age * Math.PI * 2)) / 2;
  const rows: string[] = [];
  for (let py = 0; py < MOON_SIZE; py++) {
    const dy = py + 0.5 - CENTRE;
    const inside = R * R - dy * dy;
    if (inside <= 0) {
      rows.push('.'.repeat(MOON_SIZE));
      continue;
    }
    const halfW = Math.sqrt(inside);
    const x0 = Math.floor(CENTRE - halfW + 0.5);
    const x1 = Math.ceil(CENTRE + halfW - 0.5); // exclusive
    const discW = Math.max(0, x1 - x0);
    const lit = Math.round(discW * litFraction);
    let row = '.'.repeat(x0);
    for (let i = 0; i < discW; i++) {
      const isLit = waxing ? i >= discW - lit : i < lit;
      row += isLit ? 'm' : 'e';
    }
    row += '.'.repeat(MOON_SIZE - row.length);
    rows.push(row);
  }
  return rows;
}

export const MOON_MAP_PALETTE = { m: PALETTE.moon, e: PALETTE.earthshine } as const;

export function moonBuffer(frame: MoonFrame): PixelBuffer {
  const buf = new PixelBuffer(MOON_SIZE, MOON_SIZE);
  buf.blit(moonPixelMap(frame), MOON_MAP_PALETTE, 0, 0);
  return buf;
}

/** Width in art px of the lit part at the widest row. Used by tests and the squint check. */
export function litWidthAtEquator(frame: MoonFrame): number {
  const row = moonPixelMap(frame)[CENTRE] ?? '';
  return (row.match(/m/g) ?? []).length;
}
