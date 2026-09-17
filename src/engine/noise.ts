import { hash01 } from './rng';

const smooth = (t: number): number => t * t * (3 - 2 * t);

/** 1D value noise in [0, 1), smooth between integer lattice points. Deterministic per salt. */
export function valueNoise(t: number, salt: number): number {
  const i = Math.floor(t);
  const f = smooth(t - i);
  const a = hash01(i, salt);
  const b = hash01(i + 1, salt);
  return a + (b - a) * f;
}

/** Two octaves of value noise for slightly more natural ridges. */
export function ridgeNoise(t: number, salt: number): number {
  return valueNoise(t, salt) * 0.7 + valueNoise(t * 2.3 + 7.1, salt + 1) * 0.3;
}
