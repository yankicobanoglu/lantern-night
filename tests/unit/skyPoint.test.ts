import { describe, expect, it } from 'vitest';
import { computeLayout } from '../../src/engine/layout';
import { SKY_Y_MAX, SKY_Y_MIN, pickSkyPoint, type SkyPoint } from '../../src/scene/skyPoint';

describe('pickSkyPoint', () => {
  const l = computeLayout(390, 844, 3);
  const bounds = { width: l.width, horizon: l.horizon, moon: l.moon };

  it('stays in the upper sky, normalised, and clear of the moon', () => {
    const existing: SkyPoint[] = [];
    for (let seed = 1; seed <= 400; seed++) {
      const p = pickSkyPoint(seed, bounds, existing);
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(1);
      expect(p.y).toBeGreaterThanOrEqual(SKY_Y_MIN);
      expect(p.y).toBeLessThanOrEqual(SKY_Y_MAX);
      const d = Math.hypot(p.x * l.width - l.moon.x, p.y * l.horizon - l.moon.y);
      expect(d).toBeGreaterThanOrEqual(20);
      existing.push(p);
    }
  });

  it('is deterministic per seed', () => {
    expect(pickSkyPoint(42, bounds, [])).toEqual(pickSkyPoint(42, bounds, []));
  });

  it('spreads out when it can', () => {
    const a = pickSkyPoint(5, bounds, []);
    const b = pickSkyPoint(5, bounds, [a]);
    const far = Math.abs(a.x - b.x) * l.width >= 6 || Math.abs(a.y - b.y) * l.horizon >= 6;
    expect(far).toBe(true);
  });
});
