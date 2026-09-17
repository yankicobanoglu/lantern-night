import { describe, expect, it } from 'vitest';
import { BUDGET_MS, QualityGovernor, SETTLE_MS, STEP_SETTLE_MS, WINDOW_MS } from '../../src/engine/quality';

function feed(g: QualityGovernor, dtMs: number, totalMs: number): number {
  let steps = 0;
  for (let t = 0; t < totalMs; t += dtMs) if (g.push(dtMs)) steps++;
  return steps;
}

describe('QualityGovernor (SPEC section 8: frame time > 20 ms for 2 s → fewer particles, then no bloom)', () => {
  it('starts at full and stays there at 60 fps', () => {
    const g = new QualityGovernor();
    expect(g.level).toBe(3);
    expect(feed(g, 16.7, 20_000)).toBe(0);
    expect(g.level).toBe(3);
  });

  it('ignores the first 2 s, then steps down after 2 s over budget, and again after the step settle', () => {
    const g = new QualityGovernor();
    // Settle: nothing counts yet.
    feed(g, 25, SETTLE_MS);
    expect(g.level).toBe(3);
    // A hair under 2 s of slow frames: not yet.
    feed(g, 25, WINDOW_MS - 50);
    expect(g.level).toBe(3);
    // Over the line.
    feed(g, 25, 100);
    expect(g.level).toBe(2);
    // The new level gets its settle time before it is judged.
    feed(g, 25, STEP_SETTLE_MS);
    expect(g.level).toBe(2);
    feed(g, 25, WINDOW_MS + 50);
    expect(g.level).toBe(1);
    // Never below 1.
    feed(g, 40, 10_000);
    expect(g.level).toBe(1);
  });

  it('judges the mean over the window, so a mix that averages over budget steps down and one under does not', () => {
    const slow = new QualityGovernor();
    slow.reset(0);
    for (let i = 0; i < 120; i++) slow.push(i % 2 ? 30 : 14); // mean 22, 2.6 s
    expect(slow.level).toBe(2);
    const ok = new QualityGovernor();
    ok.reset(0);
    for (let i = 0; i < 400; i++) ok.push(i % 2 ? 24 : 14); // mean 19
    expect(ok.level).toBe(3);
  });

  it('drops a stall instead of counting it, and measures fresh afterwards', () => {
    const g = new QualityGovernor();
    g.reset(0);
    feed(g, 16, 1900);
    g.push(900); // tab switch
    expect(g.level).toBe(3);
    feed(g, 16, 5000);
    expect(g.level).toBe(3);
    // Even a run of stalls never steps: they are not slow frames.
    for (let i = 0; i < 50; i++) g.push(400);
    expect(g.level).toBe(3);
  });

  it('a pinned level never moves', () => {
    const g = new QualityGovernor(3);
    feed(g, 50, 30_000);
    expect(g.level).toBe(3);
    const low = new QualityGovernor(1);
    expect(low.level).toBe(1);
  });

  it('a budget of 20 ms is the line', () => {
    const under = new QualityGovernor();
    under.reset(0);
    feed(under, BUDGET_MS - 0.5, 10_000);
    expect(under.level).toBe(3);
    const over = new QualityGovernor();
    over.reset(0);
    feed(over, BUDGET_MS + 0.5, 10_000);
    expect(over.level).toBeLessThan(3);
  });
});
