import { moonAge, moonKind } from './moonPhase';

/**
 * Real-night events (ROADMAP 4.6), all computed locally from the date.
 * Meteor showers on their calendar dates raise the shooting-star rate for the
 * night; a supermoon (a full moon near perigee) is drawn a little larger.
 */
export type MeteorShower = {
  name: string;
  /** Mean peak, local calendar month (1–12) and day. */
  month: number;
  day: number;
  /** Nights either side of the peak that still count. */
  window: number;
  /** The shooting-star interval is divided by this on those nights. */
  rate: number;
};

/** The reliable annual showers. Peaks move by a day or so from year to year; the window covers that. */
export const METEOR_SHOWERS: readonly MeteorShower[] = [
  { name: 'Quadrantids', month: 1, day: 3, window: 1, rate: 2.5 },
  { name: 'Lyrids', month: 4, day: 22, window: 1, rate: 2 },
  { name: 'Eta Aquariids', month: 5, day: 6, window: 2, rate: 2 },
  { name: 'Perseids', month: 8, day: 12, window: 2, rate: 3 },
  { name: 'Orionids', month: 10, day: 21, window: 2, rate: 2 },
  { name: 'Leonids', month: 11, day: 17, window: 1, rate: 2 },
  { name: 'Geminids', month: 12, day: 14, window: 2, rate: 3.5 },
  { name: 'Ursids', month: 12, day: 22, window: 1, rate: 1.5 },
];

const DAY_MS = 86_400_000;

/** Whole local days from the shower's peak in the same year (negative before). */
function daysFromPeak(date: Date, s: MeteorShower): number {
  const local = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const peak = new Date(date.getFullYear(), s.month - 1, s.day).getTime();
  return Math.round((local - peak) / DAY_MS);
}

/** The shower active on this local date, or null. Uses the local calendar day, like the moon label. */
export function meteorShower(date: Date): MeteorShower | null {
  for (const s of METEOR_SHOWERS) if (Math.abs(daysFromPeak(date, s)) <= s.window) return s;
  return null;
}

/** Multiplier on the shooting-star frequency tonight: 1 on an ordinary night. */
export function starRate(date: Date): number {
  return meteorShower(date)?.rate ?? 1;
}

/** Mean anomalistic month: perigee to perigee. */
export const ANOMALISTIC_DAYS = 27.554549886;
/** Reference perigee: 2024-10-17 00:51 UTC (357,364 km, the closest of that year). */
export const REFERENCE_PERIGEE_MS = Date.UTC(2024, 9, 17, 0, 51, 0);

/** Fraction of the anomalistic month since perigee, in [0, 1): 0 at perigee, 0.5 at apogee. */
export function perigeePhase(date: Date): number {
  const cycles = (date.getTime() - REFERENCE_PERIGEE_MS) / DAY_MS / ANOMALISTIC_DAYS;
  return cycles - Math.floor(cycles);
}

/**
 * The usual definition is a full moon within 90% of that orbit's closest
 * approach; under the mean model that is within about 0.1 of a cycle of
 * perigee (about 2.8 days). Perigee timing is steadiest exactly when it lines
 * up with a full moon, which is why the mean model is good enough here.
 */
export const SUPERMOON_PHASE = 0.1;

export function isSupermoon(date: Date): boolean {
  if (moonKind(moonAge(date)) !== 'full') return false;
  const p = perigeePhase(date);
  return Math.min(p, 1 - p) < SUPERMOON_PHASE;
}
