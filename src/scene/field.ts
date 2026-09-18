import { createRng } from '../engine/rng';
import type { Layout } from '../engine/layout';
import type { SkyPoint } from './skyPoint';

/**
 * Which kind of lantern this is (M7). Chosen on the wish screen, per lantern,
 * and kept for the life of that lantern: both kinds share one night, a sky
 * lantern rising into the sky band and a water lantern drifting out on the
 * lake. Until M7 this was one setting for the whole world.
 */
export type LanternKind = 'sky' | 'water';
export const LANTERN_KINDS: readonly LanternKind[] = ['sky', 'water'];

export function lanternKindOf(v: unknown): LanternKind {
  return v === 'water' ? 'water' : 'sky';
}

export type AvoidZone = { x: number; y: number; r: number };

/**
 * Where a kind's lights settle. A stored point is normalised 0–1 in both axes
 * (SPEC section 6) and is interpreted through the field of its own kind: the
 * sky band above the horizon, or the far half of the lake. Both fields are
 * live at once (M7), so the two kinds never move into each other's water.
 */
export type Field = {
  kind: LanternKind;
  /** Art px. */
  width: number;
  top: number;
  height: number;
  /** Normalised range where new lights are placed. */
  yMin: number;
  yMax: number;
  /** Art px, absolute: the moon and its clearance in the sky. */
  avoid: readonly AvoidZone[];
};

/** Sky lights live in the upper part of the sky, above the horizon glow. */
export const SKY_Y_MIN = 0.06;
export const SKY_Y_MAX = 0.6;
export const MOON_CLEARANCE = 22;
/** Water lights sit on the far half of the lake, so they read as far away. */
export const WATER_Y_MIN = 0.1;
export const WATER_Y_MAX = 0.55;
const NEIGHBOUR = 6;

export function skyField(layout: Layout): Field {
  return { kind: 'sky', width: layout.width, top: 0, height: layout.horizon, yMin: SKY_Y_MIN, yMax: SKY_Y_MAX, avoid: [{ x: layout.moon.x, y: layout.moon.y, r: MOON_CLEARANCE }] };
}

export function lakeField(layout: Layout): Field {
  return { kind: 'water', width: layout.width, top: layout.hillsEnd, height: layout.lakeEnd - layout.hillsEnd, yMin: WATER_Y_MIN, yMax: WATER_Y_MAX, avoid: [] };
}

export function fieldFor(kind: LanternKind, layout: Layout): Field {
  return kind === 'water' ? lakeField(layout) : skyField(layout);
}

export function fieldToArt(p: SkyPoint, f: Field): { x: number; y: number } {
  return { x: p.x * f.width, y: f.top + p.y * f.height };
}

/**
 * Choose where a lantern settles, from its seed. Deterministic per seed and
 * field; avoids the field's zones and, when it can, other lights' immediate neighbours.
 */
export function pickFieldPoint(seed: number, f: Field, existing: readonly SkyPoint[]): SkyPoint {
  const rng = createRng(seed);
  let best: SkyPoint = { x: 0.5, y: (f.yMin + f.yMax) / 2 };
  for (let attempt = 0; attempt < 24; attempt++) {
    const p = { x: 0.04 + rng.next() * 0.92, y: f.yMin + rng.next() * (f.yMax - f.yMin) };
    const a = fieldToArt(p, f);
    if (f.avoid.some((z) => Math.hypot(a.x - z.x, a.y - z.y) < z.r)) continue;
    best = p;
    const crowded = existing.some((e) => {
      const b = fieldToArt(e, f);
      return Math.abs(b.x - a.x) < NEIGHBOUR && Math.abs(b.y - a.y) < NEIGHBOUR;
    });
    if (!crowded) return p;
  }
  return best;
}
