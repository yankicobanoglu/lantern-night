import { describe, expect, it } from 'vitest';
import { computeLayout } from '../../src/engine/layout';
import { fieldToArt, lakeField, MOON_CLEARANCE, pickFieldPoint, SKY_Y_MAX, SKY_Y_MIN, skyField, WATER_Y_MAX, WATER_Y_MIN } from '../../src/scene/field';
import type { SkyPoint } from '../../src/scene/skyPoint';

describe('pickFieldPoint', () => {
  const l = computeLayout(390, 844, 3);
  const sky = skyField(l);
  const lake = lakeField(l);

  it('stays in the upper sky, normalised, and clear of the moon', () => {
    const existing: SkyPoint[] = [];
    for (let seed = 1; seed <= 400; seed++) {
      const p = pickFieldPoint(seed, sky, existing);
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(1);
      expect(p.y).toBeGreaterThanOrEqual(SKY_Y_MIN);
      expect(p.y).toBeLessThanOrEqual(SKY_Y_MAX);
      const d = Math.hypot(p.x * l.width - l.moon.x, p.y * l.horizon - l.moon.y);
      expect(d).toBeGreaterThanOrEqual(MOON_CLEARANCE);
      existing.push(p);
    }
  });

  it('is deterministic per seed', () => {
    expect(pickFieldPoint(42, sky, [])).toEqual(pickFieldPoint(42, sky, []));
  });

  it('spreads out when it can', () => {
    const a = pickFieldPoint(5, sky, []);
    const b = pickFieldPoint(5, sky, [a]);
    const far = Math.abs(a.x - b.x) * l.width >= 6 || Math.abs(a.y - b.y) * l.horizon >= 6;
    expect(far).toBe(true);
  });

  it('puts water lights on the far half of the lake, and the same stored point lands in each field', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const p = pickFieldPoint(seed, lake, []);
      expect(p.y).toBeGreaterThanOrEqual(WATER_Y_MIN);
      expect(p.y).toBeLessThanOrEqual(WATER_Y_MAX);
      const a = fieldToArt(p, lake);
      expect(a.y).toBeGreaterThanOrEqual(l.hillsEnd);
      expect(a.y).toBeLessThan(l.hillsEnd + (l.lakeEnd - l.hillsEnd) * 0.6);
    }
    const stored = { x: 0.3, y: 0.5 };
    expect(fieldToArt(stored, sky)).toEqual({ x: 0.3 * l.width, y: 0.5 * l.horizon });
    expect(fieldToArt(stored, lake)).toEqual({ x: 0.3 * l.width, y: l.hillsEnd + 0.5 * (l.lakeEnd - l.hillsEnd) });
  });
});
