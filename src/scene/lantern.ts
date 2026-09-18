import { Container, Sprite } from 'pixi.js';
import type { Layout } from '../engine/layout';
import type { QualityLevel } from '../engine/quality';
import { radialGlowTexture, streakTexture } from '../engine/lightTextures';
import { hash01 } from '../engine/rng';
import type { Wind } from '../engine/wind';
import { PALETTE } from '../palette';
import { sizeStage, stepRise, type RiseOptions, type RiseState } from './lanternPhysics';
import type { LanternKind } from './field';
import type { LanternSpriteSet, StageName } from './lanternTextures';
import type { SkyPoint } from './skyPoint';

export type LanternPhase = 'unlit' | 'lit' | 'rising' | 'done';

export type LanternLayers = {
  /** Pixel sprites above the shoreline (reflected by the lake). */
  above: Container;
  /** Pixel sprites drawn over the lake, in front of the water. */
  near: Container;
  /** Full-resolution additive light. */
  light: Container;
};

const HALO_TEX = 256;

/**
 * One lantern: pixel sprites in two pixel layers (see PLAN-M2 "Where lanterns
 * are drawn") and three light-layer sprites (halo, core bloom, water streak).
 * The sprite set decides what it looks like (sky lantern or water lantern);
 * the field decides where it rests and where it goes.
 */
export class Lantern {
  phase: LanternPhase = 'unlit';
  /** Paper fill 0–1 while lighting; 1 once lit. */
  fill = 0;
  /** Centre position in art px (float). */
  x: number;
  y: number;
  sky: SkyPoint | null = null;
  /** Id of the stored record (wish lanterns only). */
  storedId: string | null = null;
  /** The written text while the lantern is on the shore; cleared on release. */
  wishText: string | null = null;
  readonly rise: RiseState;
  /** No bloom (quality 1): core and streak off, halo at half. Set by the field. */
  quality: QualityLevel = 3;
  private frame = 0;
  private flickerAcc = 0;
  private readonly swayPhase: number;
  private readonly aboveSprite = new Sprite();
  private readonly nearSprite = new Sprite();
  private readonly halo: Sprite;
  private readonly core: Sprite;
  private readonly streak: Sprite;
  private stage: StageName = 'large';
  private rest: { x: number; y: number };

  /** Which kind this lantern is (M7): its sprite set says so, and it never changes. */
  get kind(): LanternKind {
    return this.set.kind;
  }

  constructor(
    readonly seed: number,
    private layout: Layout,
    private readonly set: LanternSpriteSet,
    layers: LanternLayers,
    rest: { x: number; y: number },
  ) {
    this.rest = rest;
    this.x = rest.x;
    this.y = rest.y;
    this.swayPhase = hash01(seed, 3) * Math.PI * 2;
    this.rise = { xFree: this.x, vx: 0, y: this.y, startY: this.y, target: { x: this.x, y: 0 }, p: 0, swayPhase: this.swayPhase };

    this.halo = new Sprite(radialGlowTexture(HALO_TEX, PALETTE.glow, 0.7));
    this.core = new Sprite(radialGlowTexture(HALO_TEX, PALETTE.lanternCore, 0.9));
    this.streak = new Sprite(streakTexture(96, 256, PALETTE.glow, 0.6));
    for (const s of [this.halo, this.core]) {
      s.anchor.set(0.5);
      s.blendMode = 'add';
    }
    this.streak.anchor.set(0.5, 0.12);
    this.streak.blendMode = 'add';
    layers.above.addChild(this.aboveSprite);
    layers.near.addChild(this.nearSprite);
    layers.light.addChild(this.streak, this.halo, this.core);
    this.applyTextures();
    this.place(0);
  }

  /** Start the journey toward a field point (art px target computed by the field). */
  release(target: { x: number; y: number }, sky: SkyPoint): void {
    this.phase = 'rising';
    this.fill = 1;
    this.sky = sky;
    this.rise.xFree = this.x;
    this.rise.vx = 0;
    this.rise.y = this.y;
    this.rise.startY = this.y;
    this.rise.target = target;
    this.rise.p = 0;
  }

  /** Called on resize: keep the normalised target, re-anchor a resting lantern. */
  resize(layout: Layout, target: { x: number; y: number } | null, rest: { x: number; y: number }): void {
    const oldW = Math.max(1, this.layout.width);
    this.layout = layout;
    this.rest = rest;
    if (this.phase === 'unlit' || this.phase === 'lit') {
      this.x = rest.x;
      this.y = rest.y;
    } else if (target) {
      // Rescale the free position proportionally and keep the target.
      this.rise.xFree = (this.rise.xFree / oldW) * layout.width;
      this.rise.target = target;
      const span = Math.max(1, this.rise.startY - this.rise.target.y);
      this.rise.startY = rest.y;
      this.rise.y = this.rise.startY - this.rise.p * span;
    }
  }

  /**
   * Advance by dt seconds. Returns true once the lantern has settled at its
   * field point and should hand off to the lights layer.
   */
  update(dt: number, tSec: number, wind: Wind, riseOpts: RiseOptions, swayAmp: number): boolean {
    // Flicker at roughly 8 Hz, seeded so lanterns don't blink in unison.
    this.flickerAcc += dt;
    if (this.flickerAcc > 0.1 + hash01(this.frame + this.seed, 5) * 0.06) {
      this.flickerAcc = 0;
      this.frame = (this.frame + 1 + Math.floor(hash01(this.seed * 7 + Math.floor(tSec * 10), 9) * 3)) % 4;
    }

    let handOff = false;
    if (this.phase === 'rising') {
      const r = stepRise(this.rise, dt, wind, tSec, riseOpts);
      this.x = r.x;
      this.y = this.rise.y;
      handOff = r.done;
    } else {
      // Resting: the same sway formula as the journey, so release doesn't pop.
      const rest = this.rest;
      const sway = swayAmp * Math.sin(tSec * 0.8 + this.swayPhase) + swayAmp * 0.4 * Math.sin(tSec * 1.7 + this.swayPhase * 2);
      this.x = rest.x + sway;
      this.y = rest.y + 0.6 * Math.sin(tSec * 0.5 + this.swayPhase);
    }
    const stage = sizeStage(this.phase === 'rising' ? this.rise.p : 0);
    if (stage !== this.stage) {
      this.stage = stage;
      this.applyTextures();
    } else if (stage === 'big' || stage === 'large') {
      this.applyTextures();
    } else {
      const t = stage === 'small' ? this.set.small[this.frame % 2]! : this.set.dot[this.frame % 2]!;
      this.aboveSprite.texture = t;
      this.nearSprite.texture = t;
    }
    this.place(tSec);
    if (handOff) this.phase = 'done';
    return handOff;
  }

  private applyTextures(): void {
    const t =
      this.stage === 'large'
        ? this.set.largeFor(this.frame, this.fill)
        : this.stage === 'big'
          ? this.set.bigFor(this.frame, this.fill)
          : this.stage === 'small'
            ? this.set.small[this.frame % 2]!
            : this.set.dot[this.frame % 2]!;
    this.aboveSprite.texture = t;
    this.nearSprite.texture = t;
  }

  private place(tSec: number): void {
    const { w, h } = this.set.sizes[this.stage];
    const restW = this.set.sizes.large.w;
    const px = Math.round(this.x - w / 2);
    const py = Math.round(this.y - h / 2);
    this.aboveSprite.position.set(px, py);
    this.nearSprite.position.set(px, py);
    // Below the shoreline only the near copy is visible; above it both draw identical pixels.
    this.nearSprite.visible = py + h > this.layout.hillsEnd;
    this.aboveSprite.visible = py < this.layout.hillsEnd;

    const css = this.layout.cssScale;
    const p = this.phase === 'rising' ? this.rise.p : 0;
    const flicker = 0.9 + 0.1 * Math.sin(tSec * 9 + this.swayPhase) * Math.sin(tSec * 13.7);
    const lit = this.fill;
    const cx = this.x * css;
    const cy = this.y * css;

    // Halo: about 3.4 lantern widths at rest, shrinking to a sky-light halo of ~14 art px.
    const bloom = this.quality >= 2;
    const haloD = (restW * 3.4 * (1 - p) + 14 * p) * css;
    this.halo.position.set(cx, cy);
    this.halo.width = haloD;
    this.halo.height = haloD;
    this.halo.alpha = 0.55 * lit * flicker * (bloom ? 1 : 0.5);
    this.core.visible = bloom;
    this.streak.visible = bloom;

    const coreD = (w * 1.6 + 2) * css;
    this.core.position.set(cx, cy + this.set.coreDy[this.stage] * css);
    this.core.width = coreD;
    this.core.height = coreD;
    this.core.alpha = 0.5 * lit * flicker;

    // Reflection streak on the water: under the lantern once it is over the lake, at the mirror point once above the shoreline.
    const L = this.layout;
    const squash = L.hillsEnd / Math.max(1, L.lakeEnd - L.hillsEnd);
    const bottom = this.y + h * 0.5;
    const waterY = Math.max(bottom + 2, L.hillsEnd + (L.hillsEnd - this.y) / squash);
    const overWater = Math.max(0, Math.min(1, (L.lakeEnd - bottom) / 12));
    const wobble = Math.sin(tSec * 1.3 + this.swayPhase) * 1.2 * css;
    this.streak.position.set(cx + wobble, Math.min(waterY, L.lakeEnd - 1) * css);
    this.streak.width = restW * 1.8 * css * (1 - 0.5 * p);
    this.streak.height = restW * 3.4 * css * (1 - 0.6 * p);
    this.streak.alpha = 0.4 * lit * overWater * Math.pow(1 - p, 1.5) * flicker;
  }

  /** Test hook. */
  get bloom(): boolean {
    return this.core.visible;
  }

  destroy(): void {
    this.aboveSprite.destroy();
    this.nearSprite.destroy();
    this.halo.destroy();
    this.core.destroy();
    this.streak.destroy();
  }
}
