import { describe, expect, it } from 'vitest';
import { isSupermoon, METEOR_SHOWERS, meteorShower, perigeePhase, starRate } from '../../src/ritual/nightEvents';

const evening = (iso: string): Date => new Date(`${iso}T21:00:00`);

describe('meteor showers', () => {
  it('names the big two on their peak nights and the nights around them', () => {
    expect(meteorShower(evening('2026-08-12'))?.name).toBe('Perseids');
    expect(meteorShower(evening('2026-08-10'))?.name).toBe('Perseids');
    expect(meteorShower(evening('2026-08-14'))?.name).toBe('Perseids');
    expect(meteorShower(evening('2026-08-15'))).toBeNull();
    expect(meteorShower(evening('2025-12-13'))?.name).toBe('Geminids');
    expect(meteorShower(evening('2025-12-16'))?.name).toBe('Geminids');
  });

  it('is quiet on an ordinary night', () => {
    for (const d of ['2024-09-10', '2026-09-18', '2026-03-01', '2026-07-04']) {
      expect(meteorShower(evening(d)), d).toBeNull();
      expect(starRate(evening(d)), d).toBe(1);
    }
  });

  it('raises the rate on a shower night, more for the strong showers', () => {
    expect(starRate(evening('2026-08-12'))).toBe(3);
    expect(starRate(evening('2026-12-14'))).toBe(3.5);
    expect(starRate(evening('2026-04-22'))).toBe(2);
    for (const s of METEOR_SHOWERS) expect(s.rate).toBeGreaterThan(1);
  });

  it('covers every shower on its own peak, in any year', () => {
    for (const year of [2024, 2026, 2030]) {
      for (const s of METEOR_SHOWERS) {
        const d = new Date(year, s.month - 1, s.day, 21);
        expect(meteorShower(d)?.name, `${s.name} ${year}`).toBe(s.name);
      }
    }
  });
});

describe('supermoon', () => {
  it('is 0 at the reference perigee and 0.5 half a month later', () => {
    expect(perigeePhase(new Date(Date.UTC(2024, 9, 17, 0, 51)))).toBeCloseTo(0, 6);
    expect(perigeePhase(new Date(Date.UTC(2024, 9, 17, 0, 51) + 27.554549886 * 43_200_000))).toBeCloseTo(0.5, 6);
  });

  it('matches the almanac: full moons at perigee are super, full moons at apogee are not', () => {
    for (const d of ['2023-08-31', '2024-09-18', '2024-10-17', '2024-11-15', '2025-11-05']) expect(isSupermoon(evening(d)), d).toBe(true);
    // Micromoons: 2024-02-24 (apogee the next day) and 2025-04-13 (apogee that day).
    for (const d of ['2024-02-24', '2025-04-13']) expect(isSupermoon(evening(d)), d).toBe(false);
  });

  it('never applies away from a full moon, even at perigee', () => {
    // Perigee 2024-10-17 fell on a full moon; the reference perigee two cycles on is not.
    expect(isSupermoon(evening('2024-09-10'))).toBe(false);
    expect(isSupermoon(evening('2024-12-12'))).toBe(false);
  });
});
