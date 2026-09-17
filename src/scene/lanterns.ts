import { Container } from 'pixi.js';
import { MAX_ACTIVE, REDUCED_MOTION_RISE_FACTOR, RISE_SPEED } from '../config';
import type { Layout } from '../engine/layout';
import type { MotionLevel } from '../engine/motion';
import { WindField } from '../engine/wind';
import { Lantern, type LanternLayers } from './lantern';
import type { RiseOptions } from './lanternPhysics';
import { LanternTextures } from './lanternTextures';
import { pickSkyPoint, skyToArt, type SkyBounds, type SkyPoint } from './skyPoint';

export type HandOff = { seed: number; sky: SkyPoint; id: string | null };

/**
 * Manages the active lanterns: at most one waiting over the dock, up to
 * MAX_ACTIVE rising. Hands settled lanterns to the sky layer via onHandOff.
 */
export class LanternField {
  readonly aboveLayer = new Container();
  readonly nearLayer = new Container();
  readonly lightLayer = new Container();
  readonly lanterns: Lantern[] = [];
  readonly wind: WindField;
  onHandOff: ((h: HandOff) => void) | null = null;
  /** Existing sky lights, so new sky points spread out. Set by the scene. */
  existingSky: () => readonly SkyPoint[] = () => [];
  motion: MotionLevel = 'full';
  readonly tex = new LanternTextures();
  private nextSeed: number;

  constructor(private layout: Layout, seed: number) {
    this.wind = new WindField(seed, 4);
    this.nextSeed = (seed * 7919 + 17) >>> 0;
    this.lightLayer.blendMode = 'add';
  }

  private get layers(): LanternLayers {
    return { above: this.aboveLayer, near: this.nearLayer, light: this.lightLayer };
  }

  private bounds(): SkyBounds {
    return { width: this.layout.width, horizon: this.layout.horizon, moon: this.layout.moon };
  }

  /** The lantern waiting over the dock, if any. */
  get resting(): Lantern | null {
    return this.lanterns.find((l) => l.phase === 'unlit' || l.phase === 'lit') ?? null;
  }

  get rising(): Lantern[] {
    return this.lanterns.filter((l) => l.phase === 'rising');
  }

  private takeSeed(): number {
    this.nextSeed = (this.nextSeed * 1664525 + 1013904223) >>> 0;
    return this.nextSeed;
  }

  /** Place a new unlit lantern over the dock (no-op if one is already there). */
  spawnResting(): Lantern {
    const existing = this.resting;
    if (existing) return existing;
    const l = new Lantern(this.takeSeed(), this.layout, this.tex, this.layers);
    this.lanterns.push(l);
    return l;
  }

  /** Release the resting lantern (it must be lit). */
  release(l: Lantern): boolean {
    if (l.phase !== 'lit') return false;
    if (this.rising.length >= MAX_ACTIVE) this.handOff(this.rising[0]!);
    const sky = pickSkyPoint(l.seed, this.bounds(), [...this.existingSky(), ...this.lanterns.flatMap((o) => (o.sky ? [o.sky] : []))]);
    l.release(skyToArt(sky, this.bounds()), sky);
    return true;
  }

  /** Test hook: a lit lantern already part-way up. */
  spawnRising(progress: number): Lantern {
    if (this.rising.length >= MAX_ACTIVE) this.handOff(this.rising[0]!);
    const l = new Lantern(this.takeSeed(), this.layout, this.tex, this.layers);
    l.fill = 1;
    l.phase = 'lit';
    this.lanterns.push(l);
    this.release(l);
    const span = l.rise.startY - l.rise.target.y;
    l.rise.y = l.rise.startY - span * progress;
    l.rise.p = progress;
    l.rise.xFree = l.rise.target.x + (l.x - l.rise.target.x) * (1 - progress);
    return l;
  }

  private handOff(l: Lantern): void {
    if (l.sky) this.onHandOff?.({ seed: l.seed, sky: l.sky, id: l.storedId });
    l.destroy();
    const i = this.lanterns.indexOf(l);
    if (i >= 0) this.lanterns.splice(i, 1);
  }

  private riseOptions(): RiseOptions {
    const gentle = this.motion === 'gentle';
    return {
      riseSpeed: gentle ? RISE_SPEED / REDUCED_MOTION_RISE_FACTOR : RISE_SPEED,
      swayAmp: gentle ? 0.6 : 1.2,
      minX: 8,
      maxX: this.layout.width - 8,
    };
  }

  update(dt: number, tSec: number): void {
    const opts = this.riseOptions();
    const settled: Lantern[] = [];
    for (const l of this.lanterns) {
      const wind = this.wind.sample(l.x, l.y, tSec);
      if (l.update(dt, tSec, wind, opts, opts.swayAmp)) settled.push(l);
    }
    for (const l of settled) this.handOff(l);
  }

  resize(layout: Layout): void {
    this.layout = layout;
    for (const l of this.lanterns) l.resize(layout, l.sky ? skyToArt(l.sky, this.bounds()) : null);
  }
}
