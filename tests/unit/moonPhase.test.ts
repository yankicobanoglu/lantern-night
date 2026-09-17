import { describe, expect, it } from 'vitest';
import { moonAge, moonFrame, moonKind, litFraction, isWaxing, phaseName } from '../../src/ritual/moonPhase';

const noonUtc = (iso: string): Date => new Date(`${iso}T12:00:00Z`);
const DAY = 86_400_000;

describe('moonAge', () => {
  it('is 0 at the reference new moon', () => {
    expect(moonAge(new Date(Date.UTC(2000, 0, 6, 18, 14)))).toBeCloseTo(0, 6);
  });

  it('stays in [0, 1) before and after the reference', () => {
    for (const iso of ['1999-01-01', '2000-01-05', '2026-09-17', '2099-12-31']) {
      const age = moonAge(noonUtc(iso));
      expect(age).toBeGreaterThanOrEqual(0);
      expect(age).toBeLessThan(1);
    }
  });
});

describe('moonKind fixtures (tolerance ±1 day)', () => {
  const cases: Array<[string, 'new' | 'full']> = [
    ['2024-04-08', 'new'],
    ['2025-03-29', 'new'],
    ['2024-09-18', 'full'],
    ['2025-03-14', 'full'],
  ];
  for (const [iso, expected] of cases) {
    it(`${iso} is ${expected} on the day and the day either side`, () => {
      const day = noonUtc(iso);
      for (const offset of [-1, 0, 1]) {
        const date = new Date(day.getTime() + offset * DAY);
        expect(moonKind(moonAge(date)), `${iso} offset ${offset}`).toBe(expected);
      }
    });
  }

  it('is neither new nor full at first quarter', () => {
    expect(moonKind(0.25)).toBe('none');
    expect(moonKind(0.75)).toBe('none');
  });
});

describe('moonFrame', () => {
  it('maps the cycle to the 8 frames in order and wraps', () => {
    expect(moonFrame(0)).toBe(0);
    expect(moonFrame(0.125)).toBe(1);
    expect(moonFrame(0.25)).toBe(2);
    expect(moonFrame(0.375)).toBe(3);
    expect(moonFrame(0.5)).toBe(4);
    expect(moonFrame(0.625)).toBe(5);
    expect(moonFrame(0.75)).toBe(6);
    expect(moonFrame(0.875)).toBe(7);
    expect(moonFrame(0.99)).toBe(0);
  });

  it('never skips a frame across a cycle', () => {
    let last = 0;
    for (let age = 0; age < 1; age += 0.001) {
      const f = moonFrame(age);
      expect((f - last + 8) % 8).toBeLessThanOrEqual(1);
      last = f;
    }
  });

  it('names frames', () => {
    expect(phaseName(0)).toBe('New moon');
    expect(phaseName(4)).toBe('Full moon');
    expect(phaseName(7)).toBe('Waning crescent');
  });
});

describe('litFraction and waxing', () => {
  it('is 0 at new, 1 at full, 0.5 at quarters', () => {
    expect(litFraction(0)).toBeCloseTo(0);
    expect(litFraction(0.5)).toBeCloseTo(1);
    expect(litFraction(0.25)).toBeCloseTo(0.5);
    expect(litFraction(0.75)).toBeCloseTo(0.5);
  });
  it('waxes in the first half', () => {
    expect(isWaxing(0.2)).toBe(true);
    expect(isWaxing(0.7)).toBe(false);
  });
});
