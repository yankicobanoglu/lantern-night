import { cricketTrain } from './cues';

/** A short, dark reverb tail from decaying noise, so the crickets sit in the field instead of in the phone. */
export function reverbBuffer(ctx: BaseAudioContext, seconds = 0.9): AudioBuffer {
  const n = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(2, n, ctx.sampleRate);
  let a = 0x1234567;
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < n; i++) {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      const r = (((t ^ (t >>> 14)) >>> 0) / 4294967296) * 2 - 1;
      d[i] = r * Math.exp((-4.5 * i) / n);
    }
  }
  return buf;
}

/** Two seconds of white noise, looped by every noise source. */
export function noiseBuffer(ctx: BaseAudioContext): AudioBuffer {
  const seconds = 2;
  const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
  const d = buf.getChannelData(0);
  // Deterministic so two runs sound the same.
  let a = 0x9e3779b9;
  for (let i = 0; i < d.length; i++) {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    d[i] = (((t ^ (t >>> 14)) >>> 0) / 4294967296) * 2 - 1;
  }
  return buf;
}

export function noiseSource(ctx: BaseAudioContext, buffer: AudioBuffer): AudioBufferSourceNode {
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.loop = true;
  return src;
}

/**
 * The ambient bed (SPEC section 7, Sound): soft wind from low-passed noise
 * whose cutoff and level drift on two slow LFOs, sparse cricket chirp trains
 * and occasional water lapping from band-passed noise. Nothing is sampled.
 */
export class Ambient {
  readonly out: GainNode;
  private nodes: AudioNode[] = [];
  private timers: number[] = [];
  private running = false;
  private crickets: { gain: GainNode; pitch: number }[] = [];
  private waterGain: GainNode | null = null;
  private rnd: () => number;

  constructor(private readonly ctx: AudioContext, private readonly noise: AudioBuffer, seed = 11) {
    this.out = ctx.createGain();
    this.out.gain.value = 1;
    let a = seed >>> 0;
    this.rnd = () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  get isRunning(): boolean {
    return this.running;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    const ctx = this.ctx;
    const t0 = ctx.currentTime;

    // Wind: noise → low-pass → gain, with two slow LFOs on cutoff and level.
    const wind = noiseSource(ctx, this.noise);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 320;
    lp.Q.value = 0.6;
    const windGain = ctx.createGain();
    windGain.gain.value = 0.3;
    const lfoF = ctx.createOscillator();
    lfoF.frequency.value = 0.043;
    const lfoFGain = ctx.createGain();
    lfoFGain.gain.value = 150;
    lfoF.connect(lfoFGain).connect(lp.frequency);
    const lfoA = ctx.createOscillator();
    lfoA.frequency.value = 0.097;
    const lfoAGain = ctx.createGain();
    lfoAGain.gain.value = 0.11;
    lfoA.connect(lfoAGain).connect(windGain.gain);
    wind.connect(lp).connect(windGain).connect(this.out);
    wind.start(t0);
    lfoF.start(t0);
    lfoA.start(t0);
    this.nodes.push(wind, lp, windGain, lfoF, lfoFGain, lfoA, lfoAGain);

    // Crickets (review after the live check: the single gated sine read as robotic). Two crickets, one
    // each side, each a lightly detuned pair of sines with a slow vibrato, rounded pulse envelopes,
    // a low-pass to take the edge off and a short generated reverb so they sit out in the field.
    const bus = ctx.createGain();
    bus.gain.value = 1;
    const soften = ctx.createBiquadFilter();
    soften.type = 'lowpass';
    soften.frequency.value = 5200;
    soften.Q.value = 0.5;
    const dry = ctx.createGain();
    dry.gain.value = 0.7;
    const wet = ctx.createGain();
    wet.gain.value = 0.45;
    const verb = ctx.createConvolver();
    verb.buffer = reverbBuffer(ctx);
    bus.connect(soften);
    soften.connect(dry).connect(this.out);
    soften.connect(verb).connect(wet).connect(this.out);
    this.nodes.push(bus, soften, dry, wet, verb);
    for (const [pitch, pan] of [
      [4280, -0.55],
      [4720, 0.6],
    ] as const) {
      const g = ctx.createGain();
      g.gain.value = 0;
      const panner = typeof StereoPannerNode !== 'undefined' ? ctx.createStereoPanner() : null;
      if (panner) panner.pan.value = pan;
      const vib = ctx.createOscillator();
      vib.frequency.value = 5.5 + this.rnd() * 1.5;
      const vibGain = ctx.createGain();
      vibGain.gain.value = 28;
      for (const detune of [0, 7]) {
        const o = ctx.createOscillator();
        o.type = 'sine';
        o.frequency.value = pitch;
        o.detune.value = detune;
        vib.connect(vibGain).connect(o.frequency);
        o.connect(g);
        o.start(t0);
        this.nodes.push(o);
      }
      vib.start(t0);
      if (panner) g.connect(panner).connect(bus);
      else g.connect(bus);
      this.nodes.push(g, vib, vibGain, ...(panner ? [panner] : []));
      this.crickets.push({ gain: g, pitch });
    }

    // Water lapping: band-passed noise with a slow swell.
    const water = noiseSource(ctx, this.noise);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 520;
    bp.Q.value = 0.9;
    const wg = ctx.createGain();
    wg.gain.value = 0;
    water.connect(bp).connect(wg).connect(this.out);
    water.start(t0);
    this.waterGain = wg;
    this.nodes.push(water, bp, wg);

    this.crickets.forEach((_, i) => this.scheduleCrickets(i, 2 + this.rnd() * 4 + i * 3));
    this.scheduleWater(2 + this.rnd() * 4);
  }

  private scheduleCrickets(which: number, delayS: number): void {
    const id = window.setTimeout(() => {
      const c = this.crickets[which];
      if (!this.running || !c) return;
      const g = c.gain.gain;
      const now = this.ctx.currentTime;
      // A bout of 3–6 chirps at a steady but not metronomic pace, then a long rest.
      const chirps = 3 + Math.floor(this.rnd() * 4);
      const pace = 0.42 + this.rnd() * 0.25;
      let at = now + 0.05;
      for (let k = 0; k < chirps; k++) {
        // The bout swells in and fades out; every pulse lands a little differently.
        const bout = Math.sin(((k + 0.5) / chirps) * Math.PI) * 0.6 + 0.4;
        for (const on of cricketTrain(this.rnd())) {
          const t = at + on + (this.rnd() - 0.5) * 0.006;
          const peak = 0.03 * bout * (0.8 + this.rnd() * 0.4);
          g.setValueAtTime(0, t);
          g.setTargetAtTime(peak, t, 0.004);
          g.setTargetAtTime(0, t + 0.014, 0.009);
        }
        at += pace * (0.9 + this.rnd() * 0.2);
      }
      this.scheduleCrickets(which, at - now + 6 + this.rnd() * 14);
    }, delayS * 1000);
    this.timers.push(id);
  }

  private scheduleWater(delayS: number): void {
    const id = window.setTimeout(() => {
      if (!this.running || !this.waterGain) return;
      const g = this.waterGain.gain;
      const now = this.ctx.currentTime;
      g.cancelScheduledValues(now);
      g.setValueAtTime(g.value, now);
      g.linearRampToValueAtTime(0.11 + this.rnd() * 0.05, now + 0.5 + this.rnd() * 0.4);
      g.linearRampToValueAtTime(0, now + 1.7 + this.rnd() * 0.8);
      this.scheduleWater(4 + this.rnd() * 6);
    }, delayS * 1000);
    this.timers.push(id);
  }

  stop(): void {
    if (!this.running) return;
    this.running = false;
    for (const t of this.timers) window.clearTimeout(t);
    this.timers = [];
    for (const n of this.nodes) {
      if (n instanceof AudioScheduledSourceNode) {
        try {
          n.stop();
        } catch {
          /* already stopped */
        }
      }
      n.disconnect();
    }
    this.nodes = [];
    this.crickets = [];
    this.waterGain = null;
  }
}
