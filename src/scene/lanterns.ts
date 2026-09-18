import { Container } from 'pixi.js';
import { MAX_ACTIVE, REDUCED_MOTION_RISE_FACTOR, RISE_SPEED, WATCH_BUTTONS_MIN_PROGRESS, WATCH_BUTTONS_SKY_FRACTION, WATER_DRIFT_SPEED } from '../config';
import type { Layout } from '../engine/layout';
import type { MotionLevel } from '../engine/motion';
import type { QualityLevel } from '../engine/quality';
import { WindField, type Wind } from '../engine/wind';
import { fieldFor, fieldToArt, pickFieldPoint, type Field, type SceneKind } from './field';
import { Lantern, type LanternLayers } from './lantern';
import type { RiseOptions } from './lanternPhysics';
import { lanternSpriteSet, type LanternSpriteSet } from './lanternTextures';
import type { SkyPoint } from './skyPoint';

export type HandOff = { seed: number; sky: SkyPoint; id: string | null };

/**
 * Manages the active lanterns: at most one waiting at the rest point, up to
 * MAX_ACTIVE on their way. Hands settled lanterns to the lights layer via
 * onHandOff. The scene kind chooses the sprite set, the rest point, the field
 * the lanterns settle in and how they move (rising on the wind, or drifting
 * out across the lake).
 */
export class LanternField {
  readonly aboveLayer = new Container();
  readonly nearLayer = new Container();
  readonly lightLayer = new Container();
  readonly lanterns: Lantern[] = [];
  readonly wind: WindField;
  readonly set: LanternSpriteSet;
  field: Field;
  onHandOff: ((h: HandOff) => void) | null = null;
  /** Existing lights, so new field points spread out. Set by the scene. */
  existingSky: () => readonly SkyPoint[] = () => [];
  motion: MotionLevel = 'full';
  quality: QualityLevel = 3;
  private nextSeed: number;

  constructor(
    private layout: Layout,
    seed: number,
    readonly kind: SceneKind = 'sky',
  ) {
    this.wind = new WindField(seed, 4);
    this.nextSeed = (seed * 7919 + 17) >>> 0;
    this.lightLayer.blendMode = 'add';
    this.set = lanternSpriteSet(kind);
    this.field = fieldFor(kind, layout);
  }

  setQuality(level: QualityLevel): void {
    this.quality = level;
    for (const l of this.lanterns) l.quality = level;
  }

  private get layers(): LanternLayers {
    return { above: this.aboveLayer, near: this.nearLayer, light: this.lightLayer };
  }

  /** Where an unlit lantern waits, in art px. */
  restPoint(): { x: number; y: number } {
    return this.kind === 'water' ? this.layout.waterRest : this.layout.lanternRest;
  }

  /** The lantern waiting at the rest point, if any. */
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

  /** Place a new unlit lantern at the rest point (no-op if one is already there). */
  spawnResting(): Lantern {
    const existing = this.resting;
    if (existing) return existing;
    const l = new Lantern(this.takeSeed(), this.layout, this.set, this.layers, this.restPoint());
    l.quality = this.quality;
    this.lanterns.push(l);
    return l;
  }

  /** Release the resting lantern (it must be lit). */
  release(l: Lantern): boolean {
    if (l.phase !== 'lit') return false;
    if (this.rising.length >= MAX_ACTIVE) this.handOff(this.rising[0]!);
    const sky = pickFieldPoint(l.seed, this.field, [...this.existingSky(), ...this.lanterns.flatMap((o) => (o.sky ? [o.sky] : []))]);
    l.release(fieldToArt(sky, this.field), sky);
    return true;
  }

  /** Test hook: a lit lantern already part-way along. */
  spawnRising(progress: number): Lantern {
    if (this.rising.length >= MAX_ACTIVE) this.handOff(this.rising[0]!);
    const l = new Lantern(this.takeSeed(), this.layout, this.set, this.layers, this.restPoint());
    l.quality = this.quality;
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

  /**
   * The released lantern is well on its way (the watch buttons may fade in):
   * in the sky, above the middle of the sky band or already small; on the
   * water, past the middle of its drift.
   */
  wellOnItsWay(l: Lantern): boolean {
    if (l.phase !== 'rising') return true;
    if (this.kind === 'water') return l.rise.p >= 0.5;
    return l.y <= this.layout.horizon * (1 - WATCH_BUTTONS_SKY_FRACTION) || l.rise.p >= WATCH_BUTTONS_MIN_PROGRESS;
  }

  /** Settle a lantern on its way right now (scene change): its light is handed off at once. */
  settleNow(l: Lantern): void {
    if (l.phase === 'rising') this.handOff(l);
  }

  private handOff(l: Lantern): void {
    if (l.sky) this.onHandOff?.({ seed: l.seed, sky: l.sky, id: l.storedId });
    l.destroy();
    const i = this.lanterns.indexOf(l);
    if (i >= 0) this.lanterns.splice(i, 1);
  }

  private riseOptions(): RiseOptions {
    const gentle = this.motion === 'gentle';
    if (this.kind === 'water') {
      return {
        riseSpeed: gentle ? WATER_DRIFT_SPEED / REDUCED_MOTION_RISE_FACTOR : WATER_DRIFT_SPEED,
        swayAmp: gentle ? 0.25 : 0.5,
        minX: 6,
        maxX: this.layout.width - 6,
      };
    }
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
      const raw = this.wind.sample(l.x, l.y, tSec);
      // On the water the wind pushes sideways but barely against the drift.
      const wind: Wind = this.kind === 'water' ? { x: raw.x * 0.6, y: raw.y * 0.15 } : raw;
      if (l.update(dt, tSec, wind, opts, opts.swayAmp)) settled.push(l);
    }
    for (const l of settled) this.handOff(l);
  }

  resize(layout: Layout): void {
    this.layout = layout;
    this.field = fieldFor(this.kind, layout);
    const rest = this.restPoint();
    for (const l of this.lanterns) l.resize(layout, l.sky ? fieldToArt(l.sky, this.field) : null, rest);
  }
}
