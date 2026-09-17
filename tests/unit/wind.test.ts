import { describe, expect, it } from 'vitest';
import { valueNoise2D } from '../../src/engine/noise';
import { WindField } from '../../src/engine/wind';

describe('valueNoise2D', () => {
  it('stays in [0, 1) and is deterministic', () => {
    for (let i = 0; i < 500; i++) {
      const x = (i * 0.37) % 23;
      const y = (i * 0.91) % 17;
      const v = valueNoise2D(x, y, 5);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
      expect(valueNoise2D(x, y, 5)).toBe(v);
    }
  });

  it('is continuous across lattice edges', () => {
    const a = valueNoise2D(2.9999, 3.5, 9);
    const b = valueNoise2D(3.0001, 3.5, 9);
    expect(Math.abs(a - b)).toBeLessThan(0.01);
  });
});

describe('WindField', () => {
  const wind = new WindField(7);

  it('is bounded by its strength', () => {
    let max = 0;
    for (let x = 0; x < 300; x += 7) {
      for (let y = 0; y < 200; y += 5) {
        const w = wind.sample(x, y, 12);
        max = Math.max(max, Math.hypot(w.x, w.y));
      }
    }
    expect(max).toBeGreaterThan(0.5);
    expect(max).toBeLessThanOrEqual(wind.strength * 1.5);
  });

  it('is smooth in space and time', () => {
    const a = wind.sample(100, 80, 3);
    const b = wind.sample(101, 80, 3);
    const c = wind.sample(100, 80, 3.05);
    expect(Math.abs(a.x - b.x) + Math.abs(a.y - b.y)).toBeLessThan(0.6);
    expect(Math.abs(a.x - c.x) + Math.abs(a.y - c.y)).toBeLessThan(0.3);
  });

  it('is nearly divergence-free', () => {
    const eps = 0.5;
    for (const [x, y] of [[40, 30], [120, 90], [200, 50]] as const) {
      const dx = (wind.sample(x + eps, y, 2).x - wind.sample(x - eps, y, 2).x) / (2 * eps);
      const dy = (wind.sample(x, y + eps, 2).y - wind.sample(x, y - eps, 2).y) / (2 * eps);
      expect(Math.abs(dx + dy)).toBeLessThan(0.05);
    }
  });

  it('actually changes over time', () => {
    const a = wind.sample(100, 80, 0);
    const b = wind.sample(100, 80, 60);
    expect(Math.abs(a.x - b.x) + Math.abs(a.y - b.y)).toBeGreaterThan(0.05);
  });
});
