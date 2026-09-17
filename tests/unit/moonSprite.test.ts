import { describe, expect, it } from 'vitest';
import { litWidthAtEquator, moonPixelMap, MOON_SIZE } from '../../src/scene/sprites/moon';
import type { MoonFrame } from '../../src/ritual/moonPhase';

const frames = [0, 1, 2, 3, 4, 5, 6, 7] as MoonFrame[];
const count = (map: string[], ch: string): number => map.join('').split(ch).length - 1;
const meanX = (map: string[], ch: string): number => {
  let sum = 0;
  let n = 0;
  map.forEach((row) => {
    for (let x = 0; x < row.length; x++) {
      if (row[x] === ch) {
        sum += x;
        n++;
      }
    }
  });
  return n ? sum / n : NaN;
};

describe('moon sprite frames', () => {
  it('draws the full disc in every frame (earthshine fills the unlit part)', () => {
    const discs = frames.map((f) => count(moonPixelMap(f), 'm') + count(moonPixelMap(f), 'e'));
    for (const d of discs) expect(d).toBe(discs[0]);
    expect(discs[0]).toBeGreaterThan(700);
    expect(moonPixelMap(0).length).toBe(MOON_SIZE);
  });

  it('new moon is all earthshine, full moon is all lit', () => {
    expect(count(moonPixelMap(0), 'm')).toBe(0);
    expect(count(moonPixelMap(4), 'e')).toBe(0);
  });

  it('lit area grows to full then shrinks', () => {
    const lit = frames.map((f) => count(moonPixelMap(f), 'm'));
    for (let i = 1; i <= 4; i++) expect(lit[i]!).toBeGreaterThan(lit[i - 1]!);
    for (let i = 5; i < 8; i++) expect(lit[i]!).toBeLessThan(lit[i - 1]!);
  });

  it('waxing frames are lit on the right, waning on the left', () => {
    for (const f of [1, 2, 3] as MoonFrame[]) expect(meanX(moonPixelMap(f), 'm')).toBeGreaterThan(MOON_SIZE / 2);
    for (const f of [5, 6, 7] as MoonFrame[]) expect(meanX(moonPixelMap(f), 'm')).toBeLessThan(MOON_SIZE / 2);
  });

  it('thinnest crescents are at least 4 art px wide', () => {
    expect(litWidthAtEquator(1)).toBeGreaterThanOrEqual(4);
    expect(litWidthAtEquator(7)).toBeGreaterThanOrEqual(4);
  });
});
