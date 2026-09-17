/** Rolling frame statistics for the performance budget (SPEC section 8). */
export class FrameStats {
  private samples: number[] = [];
  private readonly size: number;
  frames = 0;

  constructor(size = 180) {
    this.size = size;
  }

  push(frameMs: number): void {
    this.frames++;
    this.samples.push(frameMs);
    if (this.samples.length > this.size) this.samples.shift();
  }

  get avgMs(): number {
    if (this.samples.length === 0) return 0;
    return this.samples.reduce((a, b) => a + b, 0) / this.samples.length;
  }

  get fps(): number {
    const avg = this.avgMs;
    return avg > 0 ? 1000 / avg : 0;
  }

  get p95Ms(): number {
    if (this.samples.length === 0) return 0;
    const sorted = [...this.samples].sort((a, b) => a - b);
    return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))] ?? 0;
  }

  reset(): void {
    this.samples = [];
    this.frames = 0;
  }
}

/** Fires `fn(tick)` at a fixed low rate regardless of the frame rate. */
export class SlowTick {
  private acc = 0;
  private readonly interval: number;
  tick = 0;

  constructor(hz: number, private readonly fn: (tick: number) => void) {
    this.interval = 1000 / hz;
  }

  advance(dtMs: number): void {
    this.acc += dtMs;
    // Never run more than a couple of ticks per frame after a stall.
    let runs = 0;
    while (this.acc >= this.interval && runs < 2) {
      this.acc -= this.interval;
      this.tick++;
      this.fn(this.tick);
      runs++;
    }
    if (this.acc > this.interval * 2) this.acc = 0;
  }
}
