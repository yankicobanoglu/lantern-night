/**
 * Pure helpers for the soundscape (SPEC section 7, Sound). Everything that
 * needs an AudioContext lives in engine.ts; this file is unit-testable.
 */

/** Decibels to a linear gain. */
export function dbToGain(db: number): number {
  return Math.pow(10, db / 20);
}

/** Master level: about −18 dB. */
export const MASTER_DB = -18;
/** The master fades in over 2 s. */
export const MASTER_FADE_S = 2;

/** C major pentatonic, C5 D5 E5 G5 A5, in Hz. */
export const CHIME_NOTES = [523.25, 587.33, 659.25, 783.99, 880.0] as const;

/** Pick a chime note from a unit random. */
export function pickChime(u: number): number {
  const i = Math.min(CHIME_NOTES.length - 1, Math.max(0, Math.floor(u * CHIME_NOTES.length)));
  return CHIME_NOTES[i]!;
}

/** Bell partials: ratio to the fundamental, level, decay time constant in seconds. */
export const BELL_PARTIALS: readonly { ratio: number; level: number; decay: number }[] = [
  { ratio: 1, level: 1, decay: 1.1 },
  { ratio: 2.0, level: 0.45, decay: 0.75 },
  { ratio: 3.01, level: 0.22, decay: 0.5 },
  { ratio: 4.16, level: 0.1, decay: 0.32 },
];

/** Flame whoosh: band-pass centre and level as the hold fill goes 0→1. */
export function flameCurve(fill: number): { hz: number; gain: number } {
  const f = Math.max(0, Math.min(1, fill));
  return { hz: 260 + 1100 * f * f, gain: 0.55 * Math.pow(f, 1.4) };
}

/** Shimmer partials for a shooting star: a small falling cluster above 2 kHz. */
export function shimmerPartials(u: number): { hz: number; at: number }[] {
  const out: { hz: number; at: number }[] = [];
  for (let i = 0; i < 6; i++) {
    const v = (u * 7919 + i * 0.618) % 1;
    out.push({ hz: 2400 + 2600 * v, at: 0.04 * i + 0.03 * v });
  }
  return out;
}
