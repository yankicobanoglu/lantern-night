import { describe, expect, it } from 'vitest';
import { BELL_PARTIALS, CHIME_NOTES, cricketTrain, dbToGain, flameCurve, MASTER_DB, pickChime, shimmerPartials } from '../../src/audio/cues';

describe('sound helpers', () => {
  it('sets the master at about −18 dB', () => {
    expect(MASTER_DB).toBe(-18);
    expect(dbToGain(-18)).toBeCloseTo(0.1259, 3);
    expect(dbToGain(0)).toBe(1);
  });

  it('chimes only on C major pentatonic C5 D5 E5 G5 A5', () => {
    expect(CHIME_NOTES).toEqual([523.25, 587.33, 659.25, 783.99, 880]);
    const seen = new Set<number>();
    for (let i = 0; i < 100; i++) seen.add(pickChime(i / 100));
    expect([...seen].sort((a, b) => a - b)).toEqual([...CHIME_NOTES]);
    expect(pickChime(0)).toBe(523.25);
    expect(pickChime(0.999)).toBe(880);
    expect(pickChime(1)).toBe(880);
  });

  it('bell partials are inharmonic and decay fastest at the top', () => {
    expect(BELL_PARTIALS[0]!.ratio).toBe(1);
    for (let i = 1; i < BELL_PARTIALS.length; i++) {
      expect(BELL_PARTIALS[i]!.level).toBeLessThan(BELL_PARTIALS[i - 1]!.level);
      expect(BELL_PARTIALS[i]!.decay).toBeLessThan(BELL_PARTIALS[i - 1]!.decay);
    }
  });

  it('the whoosh grows with the hold and is silent at rest', () => {
    expect(flameCurve(0).gain).toBe(0);
    expect(flameCurve(1).gain).toBeCloseTo(0.55, 5);
    expect(flameCurve(0.5).gain).toBeGreaterThan(0);
    expect(flameCurve(0.5).gain).toBeLessThan(flameCurve(1).gain);
    expect(flameCurve(1).hz).toBeGreaterThan(flameCurve(0).hz);
    expect(flameCurve(2).gain).toBeCloseTo(0.55, 5);
    expect(flameCurve(-1).gain).toBe(0);
  });

  it('cricket trains are short bursts of 3–5 pulses', () => {
    for (const u of [0, 0.2, 0.5, 0.8, 0.999]) {
      const t = cricketTrain(u);
      expect(t.length).toBeGreaterThanOrEqual(3);
      expect(t.length).toBeLessThanOrEqual(5);
      expect(t[0]).toBe(0);
      expect(t[t.length - 1]!).toBeLessThan(1);
      for (let i = 1; i < t.length; i++) expect(t[i]!).toBeGreaterThan(t[i - 1]!);
    }
  });

  it('shimmer partials sit above 2 kHz and start within a quarter second', () => {
    const p = shimmerPartials(0.37);
    expect(p).toHaveLength(6);
    for (const x of p) {
      expect(x.hz).toBeGreaterThanOrEqual(2400);
      expect(x.hz).toBeLessThanOrEqual(5000);
      expect(x.at).toBeGreaterThanOrEqual(0);
      expect(x.at).toBeLessThan(0.3);
    }
  });
});
