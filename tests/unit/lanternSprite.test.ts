import { describe, expect, it } from 'vitest';
import { PALETTE } from '../../src/palette';
import {
  FRAMES,
  LANTERN_H,
  LANTERN_W,
  LIT_PALETTE,
  PAPER_ROWS,
  SMALL_H,
  SMALL_W,
  SKY_LIGHT_PALETTE,
  UNLIT_PALETTE,
  lanternMap,
  lanternMaps,
  mapColours,
  skyLightMap,
  smallLanternMap,
} from '../../src/scene/sprites/lantern';

const allowed = new Set<number>(Object.values(PALETTE));

describe('lantern sprite', () => {
  it('is 12×16 in every frame and uses only palette colours', () => {
    for (let f = 0; f < FRAMES; f++) {
      const map = lanternMap(f);
      expect(map.length).toBe(LANTERN_H);
      for (const row of map) expect(row.length).toBe(LANTERN_W);
      for (const c of mapColours(map, LIT_PALETTE)) expect(allowed.has(c)).toBe(true);
      for (const c of mapColours(map, UNLIT_PALETTE)) expect(allowed.has(c)).toBe(true);
    }
  });

  it('has 4 distinct flicker frames', () => {
    const seen = new Set(Array.from({ length: FRAMES }, (_, f) => lanternMap(f).join('/')));
    expect(seen.size).toBe(FRAMES);
  });

  it('fills from the bottom monotonically and lights the flame only when filling', () => {
    let prev = -1;
    for (let fill = 0; fill <= 1.0001; fill += 0.1) {
      const { lit, unlit, litRows } = lanternMaps(0, fill);
      expect(litRows).toBeGreaterThanOrEqual(prev);
      prev = litRows;
      // Lit paper rows are a contiguous block ending at the ring.
      const litPaper = lit.slice(0, PAPER_ROWS).map((r) => /[pcr]/.test(r));
      const first = litPaper.indexOf(true);
      if (first >= 0) expect(litPaper.slice(first).every(Boolean)).toBe(true);
      // No row is both lit and unlit.
      for (let y = 0; y < PAPER_ROWS; y++) {
        const a = /[pcr]/.test(lit[y] ?? '');
        const b = /[pcr]/.test(unlit[y] ?? '');
        expect(a && b).toBe(false);
      }
      const flame = mapColours(lit, LIT_PALETTE).has(PALETTE.flame) || (lit[22] ?? '').includes('y');
      expect(flame).toBe(fill > 0);
    }
    expect(lanternMaps(0, 1).litRows).toBe(PAPER_ROWS);
    expect(lanternMaps(0, 0).litRows).toBe(0);
  });

  it('unlit paper is plum, lit paper is the lantern colour', () => {
    const { unlit } = lanternMaps(0, 0);
    const { lit } = lanternMaps(0, 1);
    expect(mapColours(unlit, UNLIT_PALETTE).has(PALETTE.plum)).toBe(true);
    expect(mapColours(unlit, UNLIT_PALETTE).has(PALETTE.lantern)).toBe(false);
    expect(mapColours(lit, LIT_PALETTE).has(PALETTE.lantern)).toBe(true);
  });

  it('small lantern is 6×8 with two frames', () => {
    for (const f of [0, 1]) {
      const m = smallLanternMap(f);
      expect(m.length).toBe(SMALL_H);
      for (const row of m) expect(row.length).toBe(SMALL_W);
    }
    expect(smallLanternMap(0).join()).not.toBe(smallLanternMap(1).join());
  });

  it('sky lights are warm and at least 2×2, came-true is larger', () => {
    for (const status of ['rising', 'still-growing', 'let-go', 'came-true'] as const) {
      const m = skyLightMap(status);
      expect(m.length).toBeGreaterThanOrEqual(2);
      expect(m[0]!.length).toBeGreaterThanOrEqual(2);
      const colours = mapColours(m, SKY_LIGHT_PALETTE);
      expect(colours.has(PALETTE.star)).toBe(false);
      for (const c of colours) expect([PALETTE.lantern, PALETTE.lanternCore, PALETTE.ember]).toContain(c);
    }
    expect(skyLightMap('came-true').length).toBe(5);
    expect(skyLightMap('rising').length).toBe(4);
  });
});
