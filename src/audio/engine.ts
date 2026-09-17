import { Ambient, noiseBuffer, noiseSource } from './ambient';
import { BELL_PARTIALS, dbToGain, flameCurve, MASTER_DB, MASTER_FADE_S, pickChime, shimmerPartials } from './cues';

export type AudioState = { started: boolean; running: boolean; muted: boolean };

/**
 * The soundscape (SPEC section 7, Sound), all generated with Web Audio.
 * One AudioContext, created on the first user gesture and resumed on later
 * ones until it runs (iOS starts audio only from a gesture). The master sits
 * at about −18 dB and fades in over 2 s. Sound off keeps the context and
 * silences the master; hidden tabs suspend it.
 */
export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private ambient: Ambient | null = null;
  private flameGain: GainNode | null = null;
  private flameFilter: BiquadFilterNode | null = null;
  private enabled = true;
  private rnd = Math.random;

  constructor() {
    if (typeof document === 'undefined') return;
    const unlock = (): void => this.unlock();
    document.addEventListener('pointerdown', unlock, { capture: true, passive: true });
    document.addEventListener('keydown', unlock, { capture: true });
    document.addEventListener('visibilitychange', () => {
      const ctx = this.ctx;
      if (!ctx) return;
      if (document.hidden) void ctx.suspend().catch(() => undefined);
      else if (this.enabled) void ctx.resume().catch(() => undefined);
    });
  }

  /** Test hook: a seeded random for the chime note. */
  useRandom(fn: () => number): void {
    this.rnd = fn;
  }

  get state(): AudioState {
    return { started: this.ctx !== null, running: this.ctx?.state === 'running', muted: !this.enabled };
  }

  /** Settings.sound: on starts the bed and fades the master in; off silences everything. */
  setEnabled(on: boolean): void {
    this.enabled = on;
    if (!this.ctx || !this.master) return;
    const now = this.ctx.currentTime;
    const g = this.master.gain;
    g.cancelScheduledValues(now);
    g.setValueAtTime(g.value, now);
    if (on) {
      void this.ctx.resume().catch(() => undefined);
      this.ambient?.start();
      g.linearRampToValueAtTime(dbToGain(MASTER_DB), now + MASTER_FADE_S);
    } else {
      g.linearRampToValueAtTime(0, now + 0.3);
      window.setTimeout(() => {
        if (!this.enabled) this.ambient?.stop();
      }, 400);
    }
  }

  /** Called from every user gesture: create the context the first time, resume it until it runs. */
  unlock(): void {
    const Ctor = (window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext) as typeof AudioContext | undefined;
    if (!Ctor) return;
    if (!this.ctx) {
      let ctx: AudioContext;
      try {
        ctx = new Ctor();
      } catch {
        return;
      }
      this.ctx = ctx;
      this.master = ctx.createGain();
      this.master.gain.value = 0;
      this.master.connect(ctx.destination);
      this.noise = noiseBuffer(ctx);
      this.ambient = new Ambient(ctx, this.noise);
      this.ambient.out.connect(this.master);
      // Flame whoosh: noise → band-pass → gain, driven by the hold fill.
      const src = noiseSource(ctx, this.noise);
      this.flameFilter = ctx.createBiquadFilter();
      this.flameFilter.type = 'bandpass';
      this.flameFilter.frequency.value = 300;
      this.flameFilter.Q.value = 0.9;
      this.flameGain = ctx.createGain();
      this.flameGain.gain.value = 0;
      src.connect(this.flameFilter).connect(this.flameGain).connect(this.master);
      src.start();
      if (this.enabled) {
        this.ambient.start();
        this.master.gain.linearRampToValueAtTime(dbToGain(MASTER_DB), ctx.currentTime + MASTER_FADE_S);
      }
    }
    if (this.ctx.state !== 'running' && this.enabled) void this.ctx.resume().catch(() => undefined);
  }

  /** The hold fill changed (0–1): the whoosh grows with it and eases back when the hold lets go. */
  setFlame(fill: number): void {
    if (!this.ctx || !this.flameGain || !this.flameFilter) return;
    const { hz, gain } = flameCurve(fill);
    const now = this.ctx.currentTime;
    this.flameFilter.frequency.setTargetAtTime(hz, now, 0.08);
    this.flameGain.gain.setTargetAtTime(gain, now, 0.06);
  }

  /** Lit: the whoosh settles into a faint steady flame. */
  lit(): void {
    if (!this.ctx || !this.flameGain || !this.flameFilter) return;
    const now = this.ctx.currentTime;
    this.flameGain.gain.cancelScheduledValues(now);
    this.flameGain.gain.setTargetAtTime(0.07, now + 0.1, 0.5);
    this.flameFilter.frequency.setTargetAtTime(900, now, 0.3);
  }

  /** Released: the flame leaves with the lantern. */
  flameOff(): void {
    if (!this.ctx || !this.flameGain) return;
    this.flameGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.6);
  }

  /** Release: one bell-like chime from the pentatonic set. */
  chime(): void {
    const ctx = this.ctx;
    if (!ctx || !this.master || !this.enabled) return;
    const f0 = pickChime(this.rnd());
    const now = ctx.currentTime + 0.02;
    const bus = ctx.createGain();
    bus.gain.value = 0.42;
    bus.connect(this.master);
    let longest = 0;
    for (const p of BELL_PARTIALS) {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = f0 * p.ratio;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, now);
      g.gain.linearRampToValueAtTime(p.level, now + 0.008);
      g.gain.setTargetAtTime(0, now + 0.01, p.decay);
      osc.connect(g).connect(bus);
      osc.start(now);
      const end = now + p.decay * 6;
      osc.stop(end);
      longest = Math.max(longest, end);
    }
    window.setTimeout(() => bus.disconnect(), (longest - ctx.currentTime) * 1000 + 100);
  }

  /** Shooting star: a faint falling shimmer. */
  shimmer(): void {
    const ctx = this.ctx;
    if (!ctx || !this.master || !this.enabled) return;
    const now = ctx.currentTime + 0.02;
    const bus = ctx.createGain();
    bus.gain.value = 0.16;
    bus.connect(this.master);
    for (const p of shimmerPartials(this.rnd())) {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      const t = now + p.at;
      osc.frequency.setValueAtTime(p.hz, t);
      osc.frequency.exponentialRampToValueAtTime(p.hz * 0.72, t + 0.5);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.5, t + 0.02);
      g.gain.setTargetAtTime(0, t + 0.03, 0.14);
      osc.connect(g).connect(bus);
      osc.start(t);
      osc.stop(t + 0.9);
    }
    if (this.noise) {
      const n = noiseSource(ctx, this.noise);
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 6000;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, now);
      g.gain.linearRampToValueAtTime(0.25, now + 0.05);
      g.gain.setTargetAtTime(0, now + 0.06, 0.18);
      n.connect(hp).connect(g).connect(bus);
      n.start(now);
      n.stop(now + 1);
    }
    window.setTimeout(() => bus.disconnect(), 1400);
  }
}
