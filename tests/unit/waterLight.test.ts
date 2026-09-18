import { describe, expect, it } from 'vitest';
import { PALETTE } from '../../src/palette';
import { mapColours, skyLightMap, SKY_LIGHT_PALETTE } from '../../src/scene/sprites/lantern';
import { waterLightMap, WATER_LIGHT_H, WATER_LIGHT_PALETTE, WATER_LIGHT_W } from '../../src/scene/sprites/waterLight';

const widthOf = (row: string): number => row.length - row.split('').filter((c) => c === '.').length;

describe('the settled water light (M7)', () => {
  it('is 6×5 and every row is the declared width', () => {
    for (const status of ['rising', 'came-true', 'let-go'] as const) {
      for (const twinkle of [0, 1]) {
        const map = waterLightMap(status, twinkle);
        expect(map).toHaveLength(WATER_LIGHT_H);
        for (const row of map) expect(row.length).toBe(WATER_LIGHT_W);
      }
    }
  });

  it('is wider than it is tall, unlike the sky lantern’s square dot', () => {
    const water = waterLightMap('rising');
    const widest = Math.max(...water.map(widthOf));
    const rows = water.filter((r) => widthOf(r) > 0).length;
    expect(widest).toBeGreaterThan(rows);
    // The sky light is square, so the two never read the same.
    const sky = skyLightMap('rising');
    expect(Math.max(...sky.map(widthOf))).toBe(sky.filter((r) => widthOf(r) > 0).length);
  });

  it('carries a reflection under the body, separated by an empty row', () => {
    for (const status of ['rising', 'came-true'] as const) {
      for (const twinkle of [0, 1]) {
        const map = waterLightMap(status, twinkle);
        const bodyRows = map.map((r, i) => (r.includes('p') || r.includes('c') ? i : -1)).filter((i) => i >= 0);
        const reflection = map.map((r, i) => (r.includes('r') ? i : -1)).filter((i) => i >= 0);
        expect(bodyRows.length).toBeGreaterThanOrEqual(3);
        expect(reflection.length).toBeGreaterThanOrEqual(1);
        const lastBody = Math.max(...bodyRows);
        expect(Math.min(...reflection)).toBeGreaterThan(lastBody + 1);
        // The gap row between them is empty.
        expect(widthOf(map[lastBody + 1]!)).toBe(0);
        // The reflection is never wider than the light casting it.
        expect(widthOf(map[Math.min(...reflection)]!)).toBeLessThanOrEqual(Math.max(...bodyRows.map((i) => widthOf(map[i]!))));
      }
    }
  });

  it('came true is at least as bright and large as an ordinary light', () => {
    const plain = waterLightMap('rising');
    const bright = waterLightMap('came-true');
    const lit = (map: readonly string[]): number => map.reduce((n, r) => n + widthOf(r), 0);
    expect(lit(bright)).toBeGreaterThanOrEqual(lit(plain));
  });

  it('a let-go light is ember only, with no reflection left', () => {
    const map = waterLightMap('let-go');
    expect(mapColours(map, WATER_LIGHT_PALETTE)).toEqual(new Set([PALETTE.ember]));
    for (const row of map) expect(row.includes('c')).toBe(false);
  });

  it('uses only palette colours, and the same three the sky light uses', () => {
    for (const status of ['rising', 'came-true', 'let-go'] as const) {
      const used = mapColours(waterLightMap(status), WATER_LIGHT_PALETTE);
      for (const c of used) expect(Object.values(PALETTE)).toContain(c);
    }
    expect(WATER_LIGHT_PALETTE).toEqual(SKY_LIGHT_PALETTE);
  });
});
