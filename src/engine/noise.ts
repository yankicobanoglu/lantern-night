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

/** 2D value noise in [0, 1), bilinear with smoothstep, deterministic per salt. */
export function valueNoise2D(x: number, y: number, salt: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const fx = smooth(x - xi);
  const fy = smooth(y - yi);
  const h = (i: number, j: number): number => hash01(i + j * 7919, salt);
  const a = h(xi, yi);
  const b = h(xi + 1, yi);
  const c = h(xi, yi + 1);
  const d = h(xi + 1, yi + 1);
  const top = a + (b - a) * fx;
  const bottom = c + (d - c) * fx;
  return top + (bottom - top) * fy;
}
