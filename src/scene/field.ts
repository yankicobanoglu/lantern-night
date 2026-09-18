import { createRng } from '../engine/rng';
import type { Layout } from '../engine/layout';
import type { SkyPoint } from './skyPoint';

/** Which world the ritual plays in (ROADMAP 4.1). Chosen in Settings; the stored sky is shared. */
export type SceneKind = 'sky' | 'water';
export const SCENE_KINDS: readonly SceneKind[] = ['sky', 'water'];

export function sceneKindOf(v: unknown): SceneKind {
  return v === 'water' ? 'water' : 'sky';
}

export type AvoidZone = { x: number; y: number; r: number };

/**
 * Where a scene's lights settle. A stored point is normalised 0–1 in both
 * axes (SPEC section 6) and is interpreted through the current field: the
 * sky band above the horizon, or the far half of the lake.
 */
export type Field = {
  kind: SceneKind;
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

export function fieldFor(kind: SceneKind, layout: Layout): Field {
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
