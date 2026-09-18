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
 * whose cutoff and level drift on two slow LFOs, and occasional water lapping
 * from band-passed noise. Nothing is sampled. (Crickets were removed after the
 * M6 review.)
 */
export class Ambient {
  readonly out: GainNode;
  private nodes: AudioNode[] = [];
  private timers: number[] = [];
  private running = false;
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

    this.scheduleWater(2 + this.rnd() * 4);
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
    this.waterGain = null;
  }
}
