/**
 * Adaptive quality (SPEC section 8): if frame time > 20 ms for 2 s, reduce
 * particles, then bloom. Pure; the scene applies the level.
 */
export type QualityLevel = 1 | 2 | 3;

export const QUALITY_NAMES: Record<QualityLevel, string> = { 3: 'full', 2: 'fewer particles', 1: 'no bloom' };

/** Frame budget and window from the spec. */
export const BUDGET_MS = 20;
export const WINDOW_MS = 2000;
/** Frames ignored after boot and after a resize, so a cold start never counts. */
export const SETTLE_MS = 2000;
/** Frames ignored after a step down, so the new level is judged fresh. */
export const STEP_SETTLE_MS = 3000;
/** A single frame longer than this is a stall (tab switch, resume), not a slow frame. */
export const STALL_MS = 250;

export class QualityGovernor {
  level: QualityLevel;
  private samples: number[] = [];
  private sum = 0;
  private settle = SETTLE_MS;

  /** A pinned level (from ?quality=) turns the governor off. */
  constructor(readonly pinned: QualityLevel | null = null) {
    this.level = pinned ?? 3;
  }

  /** Feed one frame. Returns true when the level stepped down. */
  push(dtMs: number): boolean {
    if (this.pinned !== null || this.level === 1) return false;
    if (dtMs > STALL_MS) {
      this.reset(0);
      return false;
    }
    if (this.settle > 0) {
      this.settle -= dtMs;
      return false;
    }
    this.samples.push(dtMs);
    this.sum += dtMs;
    if (this.sum < WINDOW_MS) return false;
    if (this.sum / this.samples.length > BUDGET_MS) {
      this.level = (this.level - 1) as QualityLevel;
      this.reset(STEP_SETTLE_MS);
      return true;
    }
    // Slide the window along.
    while (this.sum >= WINDOW_MS && this.samples.length > 1) this.sum -= this.samples.shift() ?? 0;
    return false;
  }

  /** Forget the window and wait before judging again (boot, resize, stall). */
  reset(settleMs = SETTLE_MS): void {
    this.samples = [];
    this.sum = 0;
    this.settle = settleMs;
  }

  /** Test hook / pinned override. */
  set(level: QualityLevel): void {
    this.level = level;
    this.reset(STEP_SETTLE_MS);
  }
}
