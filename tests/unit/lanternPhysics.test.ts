import { describe, expect, it } from 'vitest';
import { WindField } from '../../src/engine/wind';
import { sizeStage, stepRise, type RiseState } from '../../src/scene/lanternPhysics';

function run(seed: number, riseSpeed = 16): { seconds: number; x: number; s: RiseState; maxDx: number } {
  const wind = new WindField(seed, 4);
  const s: RiseState = { xFree: 73, vx: 0, y: 257, startY: 257, target: { x: 40 + seed * 7, y: 30 }, p: 0, swayPhase: seed };
  const dt = 1 / 60;
  let t = 0;
  let x = 73;
  let lastX = 73;
  let maxDx = 0;
  for (let i = 0; i < 60 * 120; i++) {
    const r = stepRise(s, dt, wind.sample(x, s.y, t), t, { riseSpeed, swayAmp: 1.2, minX: 8, maxX: 139 });
    x = r.x;
    if (i > 0) maxDx = Math.max(maxDx, Math.abs(x - lastX));
    lastX = x;
    t += dt;
    if (r.done) return { seconds: t, x, s, maxDx };
  }
  return { seconds: t, x, s, maxDx };
}

describe('stepRise', () => {
  it('reaches the sky point and lands exactly on its x', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const r = run(seed);
      expect(r.s.p).toBe(1);
      expect(r.x).toBe(r.s.target.x);
      expect(r.s.y).toBeLessThanOrEqual(r.s.target.y + 0.5);
    }
  });

  it('takes a calm 12–30 s and never jumps', () => {
    for (const seed of [1, 2, 3]) {
      const r = run(seed);
      expect(r.seconds).toBeGreaterThan(12);
      expect(r.seconds).toBeLessThan(30);
      // Under one art px per frame at 60 fps.
      expect(r.maxDx).toBeLessThan(1);
    }
  });

  it('rises monotonically even against a downdraft', () => {
    const s: RiseState = { xFree: 50, vx: 0, y: 200, startY: 200, target: { x: 50, y: 20 }, p: 0, swayPhase: 0 };
    let prev = s.y;
    for (let i = 0; i < 600; i++) {
      stepRise(s, 1 / 60, { x: 0, y: 6 }, i / 60, { riseSpeed: 16, swayAmp: 1, minX: 0, maxX: 100 });
      expect(s.y).toBeLessThanOrEqual(prev);
      prev = s.y;
    }
  });

  it('steps through the three sprite sizes', () => {
    expect(sizeStage(0)).toBe('big');
    expect(sizeStage(0.5)).toBe('small');
    expect(sizeStage(0.9)).toBe('dot');
  });
});
