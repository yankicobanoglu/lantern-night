import type { Wind } from '../engine/wind';

/**
 * Pure rise motion for one lantern (SPEC section 8): constant buoyancy that
 * eases off near the sky point, drag toward the wind, gentle sway, and a
 * steering blend so the light lands exactly on its stored sky position.
 * All units are art px and seconds.
 */
export type RiseState = {
  /** Free-floating x (wind + sway), before steering. */
  xFree: number;
  /** Wind-following horizontal velocity. */
  vx: number;
  /** Current y and the y where the rise started. */
  y: number;
  startY: number;
  /** Sky point in art px. */
  target: { x: number; y: number };
  /** Height progress 0 → 1. */
  p: number;
  swayPhase: number;
};

export type RiseOptions = {
  riseSpeed: number;
  swayAmp: number;
  /** Keep the lantern on screen while it drifts. */
  minX: number;
  maxX: number;
};

const smoothstep = (a: number, b: number, t: number): number => {
  const u = Math.max(0, Math.min(1, (t - a) / (b - a)));
  return u * u * (3 - 2 * u);
};

/** Advance by dt seconds. Returns the drawn x (after steering) and whether the rise is complete. */
export function stepRise(s: RiseState, dt: number, wind: Wind, tSec: number, o: RiseOptions): { x: number; done: boolean } {
  // Vertical: buoyancy eases from full speed to about a third near the target.
  const ease = 0.35 + 0.65 * (1 - s.p);
  const vy = -(o.riseSpeed * ease) + wind.y * 0.25;
  s.y += vy * dt;
  const span = Math.max(1, s.startY - s.target.y);
  s.p = Math.max(0, Math.min(1, (s.startY - s.y) / span));

  // Horizontal: velocity relaxes toward the wind, plus a little sway.
  s.vx += (wind.x - s.vx) * Math.min(1, 0.9 * dt);
  s.xFree += s.vx * dt;
  s.xFree = Math.max(o.minX, Math.min(o.maxX, s.xFree));
  const sway = o.swayAmp * Math.sin(tSec * 0.8 + s.swayPhase) + o.swayAmp * 0.4 * Math.sin(tSec * 1.7 + s.swayPhase * 2);

  // Steering: blend toward the sky point over the second half of the rise.
  const k = smoothstep(0.4, 1, s.p);
  const x = (s.xFree + sway) * (1 - k) + s.target.x * k;
  const done = s.p >= 1;
  return { x: done ? s.target.x : x, done };
}

/** Which sprite to show at this height. */
export function sizeStage(p: number): 'big' | 'small' | 'dot' {
  return p < 0.4 ? 'big' : p < 0.85 ? 'small' : 'dot';
}
