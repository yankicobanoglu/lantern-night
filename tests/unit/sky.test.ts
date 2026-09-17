import { describe, expect, it } from 'vitest';
import { bandBoundaries, bandWeights, horizonColour } from '../../src/scene/sky';

const sum = (a: number[]): number => a.reduce((x, y) => x + y, 0);

describe('session light arc (SPEC section 3: the horizon eases from apricot to plum)', () => {
  it('keeps the total height while the warm bands hand their rows to the night band', () => {
    const base = bandWeights(0);
    for (const e of [0, 0.1, 0.33, 0.5, 0.66, 0.9, 1]) {
      const w = bandWeights(e);
      expect(sum(w)).toBeCloseTo(sum(base), 9);
      expect(w[0]).toBeGreaterThanOrEqual(base[0]!);
      for (let i = 1; i < 5; i++) expect(w[i]).toBeCloseTo(base[i]!, 9);
    }
  });

  it('fades apricot first, then blush, then rose', () => {
    expect(bandWeights(0)[7]).toBeCloseTo(0.7);
    expect(bandWeights(1 / 6)[7]).toBeCloseTo(0.35);
    expect(bandWeights(1 / 3)[7]).toBeCloseTo(0);
    expect(bandWeights(1 / 3)[6]).toBeCloseTo(0.8);
    expect(bandWeights(2 / 3)[6]).toBeCloseTo(0);
    expect(bandWeights(2 / 3)[5]).toBeCloseTo(1);
    expect(bandWeights(1)[5]).toBeCloseTo(0);
    expect(bandWeights(1)[4]).toBeCloseTo(1.3);
  });

  it('names the horizon colour at each stage and clamps outside 0–1', () => {
    expect(horizonColour(0)).toBe('apricot');
    expect(horizonColour(0.2)).toBe('apricot');
    expect(horizonColour(0.34)).toBe('blush');
    expect(horizonColour(0.67)).toBe('rose');
    expect(horizonColour(1)).toBe('plum');
    expect(horizonColour(-1)).toBe('apricot');
    expect(horizonColour(2)).toBe('plum');
  });

  it('boundaries stay ordered, end at the horizon, and only move down as the evening deepens', () => {
    const horizon = 176;
    let prev = bandBoundaries(horizon, 0);
    expect(prev[0]).toBe(0);
    expect(prev[prev.length - 1]).toBe(horizon);
    for (let e = 0.02; e <= 1.0001; e += 0.02) {
      const b = bandBoundaries(horizon, e);
      expect(b).toHaveLength(9);
      for (let i = 1; i < b.length; i++) {
        expect(b[i]).toBeGreaterThanOrEqual(b[i - 1]!);
        // The lower edge of every band moves down or stays (the night band above it grows).
        expect(b[i]).toBeGreaterThanOrEqual(prev[i]!);
      }
      expect(b[b.length - 1]).toBe(horizon);
      prev = b;
    }
    // At the end the three warm bands are gone.
    const end = bandBoundaries(horizon, 1);
    expect(end[5]).toBe(end[8]);
  });

  it('is the M1 sky at evening 0', () => {
    expect(bandBoundaries(176)).toEqual(bandBoundaries(176, 0));
    expect(bandWeights()).toEqual([3, 2.4, 2, 1.6, 1.3, 1, 0.8, 0.7]);
  });
});
