import { Sprite, type Container, type Renderer } from 'pixi.js';
import { SLOW_TICK_HZ } from '../config';
import type { Layout } from '../engine/layout';
import type { MotionLevel } from '../engine/motion';
import { Pipeline } from '../engine/pipeline';
import { PixelBuffer } from '../engine/pixelBuffer';
import { hash01 } from '../engine/rng';
import { SlowTick } from '../engine/ticker';
import type { QualityLevel } from '../engine/quality';
import { PALETTE } from '../palette';
import type { MoonFrame } from '../ritual/moonPhase';
import { MAX_ACTIVE } from '../config';
import { Cozy } from './cozy';
import type { Field, LanternKind } from './field';
import { Fireflies } from './fireflies';
import { drawHills, type Window } from './hills';
import { Lake } from './lake';
import type { Lantern } from './lantern';
import { LanternField } from './lanterns';
import { Moon } from './moon';
import { drawShore } from './shore';
import { ShootingStar } from './shootingStar';
import { bandBoundaries, drawSkyBands, drawStars, type Star } from './sky';
import { SkyLights, type SkyLight } from './skyLights';

/**
 * One world for the ritual, holding both kinds of lantern at once (M7). A sky
 * lantern rises from the shore into the sky band; a water lantern drifts out
 * across the lake. Each kind has its own sprite set, rest point, drift tuning,
 * field and set of settled lights, and the two never mix: the kind a lantern
 * was lit as is the kind it stays. Everything else (sky, hills, cottages,
 * lake, shore, moon, fireflies, boat, mist, shooting star) is shared.
 */
export class Scene {
  readonly pipeline: Pipeline;
  readonly moon: Moon;
  /** Active lanterns, one set per kind. */
  readonly skyLanterns: LanternField;
  readonly waterLanterns: LanternField;
  /** Settled lanterns as lights: in the sky band, and on the lake. */
  readonly skyLights: SkyLights;
  readonly waterLights: SkyLights;
  readonly fireflies: Fireflies;
  readonly cozy: Cozy;
  readonly star: ShootingStar;
  /** Time multiplier for the animated parts (test hook; 1 in normal use). */
  speed = 1;
  /** Adaptive quality level (SPEC section 8); applied by setQuality. */
  quality: QualityLevel = 3;
  /** Session light arc 0–1 (SPEC section 3). */
  evening = 0;
  private skyBoundsKey = '';
  private lake: Lake;
  private staticBuf: PixelBuffer;
  private staticSprite: Sprite;
  private overlayBuf: PixelBuffer;
  private overlaySprite: Sprite;
  private shoreBuf: PixelBuffer;
  private shoreSprite: Sprite;
  private stars: Star[] = [];
  private windows: Window[] = [];
  private slow: SlowTick;
  private timeMs = 0;
  /** True on the frame a shooting star finished untapped. */
  starDone = false;
  layout: Layout;

  constructor(
    renderer: Renderer,
    stage: Container,
    layout: Layout,
    readonly seed: number,
    motion: MotionLevel,
  ) {
    this.layout = layout;
    this.pipeline = new Pipeline(renderer, stage, layout);
    this.staticBuf = new PixelBuffer(1, 1);
    this.overlayBuf = new PixelBuffer(1, 1);
    this.shoreBuf = new PixelBuffer(1, 1);
    this.staticSprite = new Sprite();
    this.overlaySprite = new Sprite();
    this.shoreSprite = new Sprite();
    this.moon = new Moon(layout, this.pipeline.light);
    this.skyLanterns = new LanternField(layout, seed, 'sky');
    this.waterLanterns = new LanternField(layout, seed ^ 0x9e37, 'water');
    this.skyLights = new SkyLights(this.skyLanterns.field, layout.cssScale);
    this.waterLights = new SkyLights(this.waterLanterns.field, layout.cssScale);
    for (const [lanterns, lights] of [
      [this.skyLanterns, this.skyLights],
      [this.waterLanterns, this.waterLights],
    ] as const) {
      lanterns.motion = motion;
      lanterns.existingSky = () => lights.points;
      lanterns.onHandOff = (h) => lights.add({ seed: h.seed, sky: h.sky, status: 'rising', kind: lanterns.kind, ...(h.id ? { id: h.id } : {}) });
    }
    this.fireflies = new Fireflies(layout, seed, motion);
    this.cozy = new Cozy(layout, seed);
    this.star = new ShootingStar(layout);
    this.star.motion = motion;

    // Pixel layers, back to front (M7 merges the two M6 orders into one world). Sky lights sit above
    // the shoreline, so the lake reflects them; water lights sit on the lake itself, in front of the
    // reflection and behind the boat, with the drifting water lanterns in front of it.
    this.lake = new Lake(layout, this.pipeline.aboveRT);
    this.pipeline.above.addChild(
      this.staticSprite,
      this.overlaySprite,
      this.cozy.smokeSprite,
      this.skyLights.sprite,
      this.moon.sprite,
      this.skyLanterns.aboveLayer,
      this.waterLanterns.aboveLayer,
    );
    this.pipeline.world.addChild(
      this.lake.container,
      this.waterLights.sprite,
      this.cozy.boatSprite,
      this.waterLanterns.nearLayer,
      this.skyLanterns.nearLayer,
      this.shoreSprite,
      this.fireflies.sprite,
    );
    // Light layer: light halos under the lanterns' own light, fireflies on top.
    this.pipeline.light.addChild(
      this.cozy.light,
      this.skyLights.halos,
      this.waterLights.halos,
      this.skyLanterns.lightLayer,
      this.waterLanterns.lightLayer,
      this.fireflies.light,
      this.star.container,
    );

    this.slow = new SlowTick(SLOW_TICK_HZ, (t) => this.slowTick(t));
    this.build(layout);
  }

  /** The two lantern sets, sky first. */
  get lanternFields(): readonly [LanternField, LanternField] {
    return [this.skyLanterns, this.waterLanterns];
  }

  lanternsOf(kind: LanternKind): LanternField {
    return kind === 'water' ? this.waterLanterns : this.skyLanterns;
  }

  lightsOf(kind: LanternKind): SkyLights {
    return kind === 'water' ? this.waterLights : this.skyLights;
  }

  /** Where a kind's lights settle (normalised points map through it). */
  fieldOf(kind: LanternKind): Field {
    return this.lanternsOf(kind).field;
  }

  /** The lantern waiting to be lit, of either kind (at most one at a time). */
  get resting(): Lantern | null {
    return this.skyLanterns.resting ?? this.waterLanterns.resting;
  }

  /** Every lantern on its way, both kinds. */
  get rising(): Lantern[] {
    return [...this.skyLanterns.rising, ...this.waterLanterns.rising];
  }

  /** Every active lantern, both kinds. */
  get activeLanterns(): Lantern[] {
    return [...this.skyLanterns.lanterns, ...this.waterLanterns.lanterns];
  }

  /** Every settled light, both kinds, sky first. */
  get allLights(): readonly SkyLight[] {
    return [...this.skyLights.lights, ...this.waterLights.lights];
  }

  /** Put a settled light back in the sky it belongs to. */
  addLight(light: SkyLight): void {
    this.lightsOf(light.kind).add(light);
  }

  clearLights(): void {
    this.skyLights.clear();
    this.waterLights.clear();
  }

  /** A return changed a stored lantern: whichever sky it is in. */
  setLightStatus(id: string, status: SkyLight['status']): void {
    this.skyLights.setStatus(id, status);
    this.waterLights.setStatus(id, status);
  }

  /**
   * Release a lit lantern. The twelve-lantern budget (SPEC section 8) counts
   * both kinds together, so the oldest one on its way settles when a
   * thirteenth is released, whichever kind it is.
   */
  release(l: Lantern): boolean {
    const rising = this.rising;
    if (rising.length >= MAX_ACTIVE) {
      const oldest = rising[0]!;
      this.lanternsOf(oldest.kind).settleNow(oldest);
    }
    return this.lanternsOf(l.kind).release(l);
  }

  /** The released lantern is far enough along for the watch buttons. */
  wellOnItsWay(l: Lantern): boolean {
    return this.lanternsOf(l.kind).wellOnItsWay(l);
  }

  build(layout: Layout): void {
    this.staticBuf.destroy();
    this.overlayBuf.destroy();
    this.shoreBuf.destroy();

    this.staticBuf = new PixelBuffer(layout.width, layout.hillsEnd);
    drawSkyBands(this.staticBuf, layout, this.evening);
    this.skyBoundsKey = bandBoundaries(layout.horizon, this.evening).join(',');
    this.stars = drawStars(this.staticBuf, layout, this.seed);
    const features = drawHills(this.staticBuf, layout, this.seed);
    this.windows = features.windows;
    this.cozy.build(layout, features.windows, features.chimneys);
    this.staticSprite.texture = this.staticBuf.toTexture();

    this.overlayBuf = new PixelBuffer(layout.width, layout.hillsEnd);
    this.overlaySprite.texture = this.overlayBuf.toTexture();

    this.shoreBuf = new PixelBuffer(layout.width, layout.height - layout.hillsEnd);
    drawShore(this.shoreBuf, layout, this.seed);
    this.shoreSprite.texture = this.shoreBuf.toTexture();
    this.shoreSprite.position.set(0, layout.hillsEnd);

    this.moon.place(layout);
    this.slowTick(this.slow.tick);
  }

  /** Session light arc: redraw the sky only when a band boundary actually moves (every few seconds). */
  setEvening(evening: number): void {
    this.evening = Math.max(0, Math.min(1, evening));
    const key = bandBoundaries(this.layout.horizon, this.evening).join(',');
    if (key === this.skyBoundsKey) return;
    this.skyBoundsKey = key;
    this.staticBuf.clear();
    drawSkyBands(this.staticBuf, this.layout, this.evening);
    drawStars(this.staticBuf, this.layout, this.seed);
    drawHills(this.staticBuf, this.layout, this.seed);
    this.staticBuf.upload();
  }

  /** Adaptive quality (SPEC section 8): 3 full, 2 fewer particles, 1 no bloom. */
  setQuality(level: QualityLevel): void {
    this.quality = level;
    this.skyLights.setQuality(level);
    this.waterLights.setQuality(level);
    this.fireflies.setQuality(level);
    this.cozy.setQuality(level);
    this.moon.setQuality(level);
    for (const f of this.lanternFields) f.setQuality(level);
  }

  /** Settings or the system changed the motion level. */
  setMotion(motion: MotionLevel): void {
    for (const f of this.lanternFields) f.motion = motion;
    this.star.motion = motion;
    this.fireflies.build(this.layout, motion);
  }

  resize(layout: Layout, motion: MotionLevel): void {
    this.layout = layout;
    this.pipeline.resize(layout);
    this.star.resize(layout);
    this.lake.build(layout, this.pipeline.aboveRT);
    for (const f of this.lanternFields) f.resize(layout);
    this.skyLights.resize(this.skyLanterns.field, layout.cssScale);
    this.waterLights.resize(this.waterLanterns.field, layout.cssScale);
    this.fireflies.build(layout, motion);
    this.build(layout);
  }

  setMoonFrame(frame: MoonFrame): void {
    this.moon.setFrame(frame);
  }

  /** Per-frame update, then the two art-px render passes. */
  update(dtMs: number): void {
    const dt = Math.min(dtMs, 100) * this.speed;
    this.timeMs += dt;
    const tSec = this.timeMs / 1000;
    this.slow.advance(dt);
    this.lake.update(this.timeMs);
    for (const f of this.lanternFields) f.update(dt / 1000, tSec);
    this.skyLights.update(tSec);
    this.waterLights.update(tSec);
    this.fireflies.update(dt / 1000, tSec);
    this.cozy.update(tSec);
    this.starDone = this.star.update(dt / 1000);
    this.pipeline.render();
  }

  /** Tear down this scene (a scene swap, or the offscreen share render). Sprite sets and cached light textures are shared and kept. */
  destroy(): void {
    for (const f of this.lanternFields) {
      for (const l of [...f.lanterns]) l.destroy();
      f.lanterns.length = 0;
    }
    this.staticBuf.destroy();
    this.overlayBuf.destroy();
    this.shoreBuf.destroy();
    this.skyLights.destroy();
    this.waterLights.destroy();
    this.moon.destroy();
    this.lake.destroy();
    this.pipeline.destroy();
  }

  private slowTick(tick: number): void {
    const o = this.overlayBuf;
    o.clear();
    // Twinkle: a few stars dim to a violet each tick.
    for (let i = 0; i < this.stars.length; i++) {
      const s = this.stars[i]!;
      const phase = hash01(i, 13) * 40;
      if (Math.sin(tick * 0.35 + phase) > 0.82) {
        o.set(s.x, s.y, PALETTE.violet);
        if (s.big) o.set(s.x + 1, s.y + 1, PALETTE.violet);
      }
    }
    // Window flicker: warm shifts between lantern, core and ember.
    for (let i = 0; i < this.windows.length; i++) {
      const w = this.windows[i]!;
      const v = hash01(tick + i * 97, 17);
      const colour = v < 0.15 ? PALETTE.ember : v > 0.85 ? PALETTE.lanternCore : PALETTE.lantern;
      if (colour !== PALETTE.lantern) o.fillRect(w.x, w.y, w.w, w.h, colour);
    }
    o.upload();
    this.lake.slowTick(tick);
    this.skyLights.drawTick(tick);
    this.waterLights.drawTick(tick);
    this.fireflies.drawTick(tick);
    this.cozy.drawTick(tick);
  }
}
