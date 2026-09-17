/**
 * Mean-phase moon model (SPEC section 5).
 * Reference new moon 2000-01-06 18:14 UTC, synodic month 29.530588853 days.
 */
export const SYNODIC_DAYS = 29.530588853;
export const REFERENCE_NEW_MOON_MS = Date.UTC(2000, 0, 6, 18, 14, 0);
const DAY_MS = 86_400_000;

export type MoonKind = 'new' | 'full' | 'none';

export const PHASE_NAMES = [
  'New moon',
  'Waxing crescent',
  'First quarter',
  'Waxing gibbous',
  'Full moon',
  'Waning gibbous',
  'Last quarter',
  'Waning crescent',
] as const;

export type MoonFrame = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;

/** Fraction of the synodic month elapsed since new moon, in [0, 1). */
export function moonAge(date: Date): number {
  const days = (date.getTime() - REFERENCE_NEW_MOON_MS) / DAY_MS;
  const cycles = days / SYNODIC_DAYS;
  return cycles - Math.floor(cycles);
}

/** New within ±0.05 of a cycle, full within ±0.05 of the half cycle. */
export function moonKind(age: number): MoonKind {
  if (age < 0.05 || age > 0.95) return 'new';
  if (Math.abs(age - 0.5) < 0.05) return 'full';
  return 'none';
}

/** Illuminated fraction of the disc, 0 at new and 1 at full. */
export function litFraction(age: number): number {
  return (1 - Math.cos(age * Math.PI * 2)) / 2;
}

/** Which of the 8 sprite frames to show for this age. */
export function moonFrame(age: number): MoonFrame {
  return (Math.round(age * 8) % 8) as MoonFrame;
}

export function phaseName(frame: MoonFrame): string {
  return PHASE_NAMES[frame];
}

/** Waxing (lit on the right) while age is in the first half of the cycle. */
export function isWaxing(age: number): boolean {
  return age < 0.5;
}
