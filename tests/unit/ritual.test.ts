import { describe, expect, it } from 'vitest';
import { arriveLine, clampText, COPY, defaultMode, intentionCopy, MAX_TEXT, moonBanner } from '../../src/ritual/copy';
import { Machine } from '../../src/ritual/machine';
import { nextMoonEvent } from '../../src/ritual/moonPhase';

describe('copy selection', () => {
  it('picks the mode and banner from the moon', () => {
    expect(defaultMode('new')).toBe('wish');
    expect(defaultMode('full')).toBe('let-go');
    expect(defaultMode('none')).toBe('wish');
    expect(moonBanner('new')).toBe('A new moon tonight. A lovely time to set an intention.');
    expect(moonBanner('full')).toBe('A full moon tonight. A gentle time to let something go.');
    expect(moonBanner('none')).toBeNull();
  });

  it('greets first and returning visitors', () => {
    expect(arriveLine(false)).toBe('Welcome. The evening is quiet tonight.');
    expect(arriveLine(true)).toBe('Welcome back. Your lanterns are still glowing.');
  });

  it('serves the right intention strings per mode', () => {
    expect(intentionCopy('wish').heading).toBe('What would you like to grow toward?');
    expect(intentionCopy('let-go').placeholder).toBe("I'm ready to release…");
    expect(intentionCopy('wish').chips).toHaveLength(8);
    expect(intentionCopy('let-go').chips).toHaveLength(4);
  });

  it('uses at most one exclamation mark per line and no emoji', () => {
    const walk = (v: unknown): string[] =>
      typeof v === 'string' ? [v] : typeof v === 'function' ? [] : typeof v === 'object' && v ? Object.values(v).flatMap(walk) : [];
    for (const line of walk(COPY)) {
      expect((line.match(/!/g) ?? []).length, line).toBeLessThanOrEqual(1);
      expect(/\p{Extended_Pictographic}/u.test(line), line).toBe(false);
    }
  });
});

describe('clampText', () => {
  it('trims and caps at 120 characters', () => {
    expect(clampText('  hello  ')).toBe('hello');
    expect(clampText('a'.repeat(200))).toHaveLength(MAX_TEXT);
    expect(clampText('x'.repeat(120))).toHaveLength(120);
  });
});

describe('Machine', () => {
  it('walks the spec flow and refuses skips', () => {
    const m = new Machine();
    const seen: string[] = [];
    m.onChange((t) => seen.push(`${t.from}>${t.to}`));
    expect(m.go('intention')).toBe(false);
    expect(m.go('arrive')).toBe(true);
    expect(m.go('light')).toBe(false);
    expect(m.go('return')).toBe(true);
    expect(m.go('intention')).toBe(true);
    expect(m.go('light')).toBe(true);
    expect(m.go('watch')).toBe(false);
    expect(m.go('release')).toBe(true);
    expect(m.go('watch')).toBe(true);
    expect(m.go('intention')).toBe(true);
    for (const s of ['light', 'release', 'watch', 'goodnight', 'arrive'] as const) expect(m.go(s)).toBe(true);
    expect(seen[0]).toBe('loading>arrive');
    expect(m.state).toBe('arrive');
  });
});

describe('nextMoonEvent', () => {
  const at = (iso: string): Date => new Date(`${iso}T21:00:00Z`);
  it('says tonight on a full or new moon day', () => {
    expect(nextMoonEvent(at('2024-09-18'))).toEqual({ kind: 'full', days: 0 });
    expect(nextMoonEvent(at('2025-03-29'))).toEqual({ kind: 'new', days: 0 });
  });
  it('counts down to the nearer of the two, and says tomorrow at one day', () => {
    // Full moon 2024-09-18: from 2024-09-10 it's 8 calendar days to the full moon and 22 to the new.
    expect(nextMoonEvent(at('2024-09-10'))).toEqual({ kind: 'full', days: 8 });
    // The evening before, the moon peaks in the small hours: still tonight. From that morning: tomorrow.
    expect(nextMoonEvent(at('2024-09-17'))).toEqual({ kind: 'full', days: 0 });
    expect(nextMoonEvent(new Date('2024-09-17T09:00:00Z'))).toEqual({ kind: 'full', days: 1 });
    expect(nextMoonEvent(at('2024-09-19'))).toEqual({ kind: 'new', days: 14 });
    expect(COPY.moon.next('full', 1)).toBe('Full moon tomorrow.');
    expect(COPY.moon.next('new', 0)).toBe('New moon tonight.');
    expect(COPY.moon.next('new', 12)).toBe('New moon in 12 days.');
  });
});
