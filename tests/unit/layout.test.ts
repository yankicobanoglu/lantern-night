import { describe, expect, it } from 'vitest';
import { computeLayout } from '../../src/engine/layout';

describe('computeLayout', () => {
  it('iPhone 12 portrait (390×844 @3x): integer scale, near-320 height', () => {
    const l = computeLayout(390, 844, 3);
    expect(l.scale).toBe(8);
    expect(l.height).toBe(317);
    expect(l.width).toBe(147);
    expect(l.landscape).toBe(false);
    expect(l.cssScale).toBeCloseTo(2.667, 2);
    expect(l.height * l.scale).toBeGreaterThanOrEqual(844 * 3);
  });

  it('desktop landscape (1280×800 @2x): 2.5 CSS px per art px', () => {
    const l = computeLayout(1280, 800, 2);
    expect(l.scale).toBe(5);
    expect(l.height).toBe(320);
    expect(l.width).toBe(512);
    expect(l.landscape).toBe(true);
    expect(l.cssScale).toBe(2.5);
  });

  it('splits rows 55/15/20/10', () => {
    const l = computeLayout(1280, 800, 2);
    expect(l.horizon).toBe(176);
    expect(l.hillsEnd).toBe(224);
    expect(l.lakeEnd).toBe(288);
  });

  it('keeps the moon in the upper right and the dock centred', () => {
    for (const l of [computeLayout(390, 844, 3), computeLayout(1280, 800, 2)]) {
      expect(l.moon.x).toBeGreaterThan(l.width * 0.6);
      expect(l.moon.y + 16).toBeLessThan(l.horizon * 0.6);
      expect(Math.abs(l.dockX - l.width / 2)).toBeLessThanOrEqual(1);
    }
  });

  it('never drops below scale 1 on tiny screens', () => {
    expect(computeLayout(200, 200, 1).scale).toBe(1);
  });
});
