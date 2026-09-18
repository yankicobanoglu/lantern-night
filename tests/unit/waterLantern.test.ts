import { describe, expect, it } from 'vitest';
import { PALETTE } from '../../src/palette';
import { mapColours } from '../../src/scene/sprites/lantern';
import {
  smallWaterLanternMap,
  WATER_BIG_H,
  WATER_BIG_W,
  WATER_FRAMES,
  WATER_LARGE_H,
  WATER_LARGE_W,
  WATER_LIT_PALETTE,
  WATER_PAPER,
  WATER_SMALL_H,
  WATER_SMALL_W,
  WATER_UNLIT_PALETTE,
  waterLanternMap,
  waterLanternMaps,
} from '../../src/scene/sprites/waterLantern';

const allowed = new Set<number>(Object.values(PALETTE));

describe('water lantern sprite (ROADMAP 4.1)', () => {
  it('is 20×15 at rest and 14×10 drifting, in every frame, with palette colours only', () => {
    for (let f = 0; f < WATER_FRAMES; f++) {
      const large = waterLanternMap(f, WATER_PAPER.large.rows, 'large');
      expect(large.length).toBe(WATER_LARGE_H);
      for (const row of large) expect(row.length).toBe(WATER_LARGE_W);
      const big = waterLanternMap(f, WATER_PAPER.big.rows, 'big');
      expect(big.length).toBe(WATER_BIG_H);
      for (const row of big) expect(row.length).toBe(WATER_BIG_W);
      for (const map of [large, big]) {
        for (const c of mapColours(map, WATER_LIT_PALETTE)) expect(allowed.has(c)).toBe(true);
        for (const c of mapColours(map, WATER_UNLIT_PALETTE)) expect(allowed.has(c)).toBe(true);
      }
    }
  });

  it('has 4 distinct flicker frames', () => {
    const seen = new Set(Array.from({ length: WATER_FRAMES }, (_, f) => waterLanternMap(f, WATER_PAPER.large.rows).join('/')));
    expect(seen.size).toBe(WATER_FRAMES);
  });

  it('fills the paper from the bottom; the frame and float always draw; the flame only once filling', () => {
    const { top, rows } = WATER_PAPER.large;
    let prev = -1;
    for (let fill = 0; fill <= 1.0001; fill += 0.125) {
      const { lit, unlit, litRows } = waterLanternMaps(0, fill);
      expect(litRows).toBeGreaterThanOrEqual(prev);
      prev = litRows;
      // Dark paper is a contiguous block at the top of the paper; lit paper the block below it.
      const dark = unlit.slice(top, top + rows).map((r) => /p/.test(r));
      const first = dark.indexOf(false);
      if (first >= 0) expect(dark.slice(first).every((d) => !d)).toBe(true);
      for (let y = top; y < top + rows; y++) expect(/[pc]/.test(lit[y] ?? '') && /[pc]/.test(unlit[y] ?? '')).toBe(false);
      // Frame rows and the float are never in the unlit part.
      for (const y of [2, 11, 12, 13, 14]) {
        expect(unlit[y]).toBe('.'.repeat(WATER_LARGE_W));
        expect(/[wd]/.test(lit[y] ?? '')).toBe(true);
      }
      const flame = /[fy]/.test((lit[0] ?? '') + (lit[1] ?? ''));
      expect(flame).toBe(fill > 0);
    }
    expect(waterLanternMaps(0, 1).litRows).toBe(rows);
    expect(waterLanternMaps(0, 0).litRows).toBe(0);
  });

  it('unlit paper is plum, lit paper is the lantern colour, the float is dark wood', () => {
    const { unlit } = waterLanternMaps(0, 0);
    const { lit } = waterLanternMaps(0, 1);
    expect(mapColours(unlit, WATER_UNLIT_PALETTE).has(PALETTE.plum)).toBe(true);
    expect(mapColours(unlit, WATER_UNLIT_PALETTE).has(PALETTE.lantern)).toBe(false);
    expect(mapColours(lit, WATER_LIT_PALETTE).has(PALETTE.lantern)).toBe(true);
    expect(mapColours(lit, WATER_LIT_PALETTE).has(PALETTE.woodDark)).toBe(true);
  });

  it('small lantern is 7×5 with two frames', () => {
    for (const f of [0, 1]) {
      const m = smallWaterLanternMap(f);
      expect(m.length).toBe(WATER_SMALL_H);
      for (const row of m) expect(row.length).toBe(WATER_SMALL_W);
    }
    expect(smallWaterLanternMap(0).join()).not.toBe(smallWaterLanternMap(1).join());
  });
});
