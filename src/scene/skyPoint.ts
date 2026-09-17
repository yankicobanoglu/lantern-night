import { createRng } from '../engine/rng';

/** Normalised 0–1 position in the sky layer (SPEC section 6, Lantern.sky). */
export type SkyPoint = { x: number; y: number };

export type SkyBounds = {
  /** Art px. */
  width: number;
  horizon: number;
  moon: { x: number; y: number };
};

/** Sky lights live in the upper part of the sky, above the horizon glow. */
export const SKY_Y_MIN = 0.06;
export const SKY_Y_MAX = 0.6;
const MOON_CLEARANCE = 22;
const NEIGHBOUR = 6;

/**
 * Choose where a lantern settles, from its seed. Deterministic per seed and
 * layout; avoids the moon and, when it can, other lights' immediate neighbours.
 */
export function pickSkyPoint(seed: number, bounds: SkyBounds, existing: readonly SkyPoint[]): SkyPoint {
  const rng = createRng(seed);
  let best: SkyPoint = { x: 0.5, y: 0.3 };
  for (let attempt = 0; attempt < 24; attempt++) {
    const p = { x: 0.04 + rng.next() * 0.92, y: SKY_Y_MIN + rng.next() * (SKY_Y_MAX - SKY_Y_MIN) };
    const ax = p.x * bounds.width;
    const ay = p.y * bounds.horizon;
    const dm = Math.hypot(ax - bounds.moon.x, ay - bounds.moon.y);
    if (dm < MOON_CLEARANCE) continue;
    best = p;
    const crowded = existing.some((e) => Math.abs(e.x * bounds.width - ax) < NEIGHBOUR && Math.abs(e.y * bounds.horizon - ay) < NEIGHBOUR);
    if (!crowded) return p;
  }
  return best;
}

export function skyToArt(p: SkyPoint, bounds: SkyBounds): { x: number; y: number } {
  return { x: p.x * bounds.width, y: p.y * bounds.horizon };
}
