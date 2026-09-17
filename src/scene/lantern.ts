import { Container, Sprite } from 'pixi.js';
import type { Layout } from '../engine/layout';
import { radialGlowTexture, streakTexture } from '../engine/lightTextures';
import { hash01 } from '../engine/rng';
import type { Wind } from '../engine/wind';
import { PALETTE } from '../palette';
import { sizeStage, stepRise, type RiseOptions, type RiseState } from './lanternPhysics';
import type { LanternTextures } from './lanternTextures';
import type { SkyPoint } from './skyPoint';
import { DOT, LANTERN_H, LANTERN_W, SMALL_H, SMALL_W } from './sprites/lantern';

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
 */
export class Lantern {
  phase: LanternPhase = 'unlit';
  /** Paper fill 0–1 while lighting; 1 once lit. */
  fill = 0;
  /** Centre position in art px (float). */
  x: number;
  y: number;
  sky: SkyPoint | null = null;
  readonly rise: RiseState;
  private frame = 0;
  private flickerAcc = 0;
  private readonly swayPhase: number;
  private readonly aboveSprite = new Sprite();
  private readonly nearSprite = new Sprite();
  private readonly halo: Sprite;
  private readonly core: Sprite;
  private readonly streak: Sprite;
  private stage: 'big' | 'small' | 'dot' = 'big';

  constructor(
    readonly seed: number,
    private layout: Layout,
    private readonly tex: LanternTextures,
    layers: LanternLayers,
  ) {
    this.x = layout.lanternRest.x;
    this.y = layout.lanternRest.y;
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

  /** Start the rise toward a sky point (art px target computed by the field). */
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

  /** Called on resize: keep normalised sky target, re-anchor a resting lantern. */
  resize(layout: Layout, target: { x: number; y: number } | null): void {
    const oldW = Math.max(1, this.layout.width);
    this.layout = layout;
    if (this.phase === 'unlit' || this.phase === 'lit') {
      this.x = layout.lanternRest.x;
      this.y = layout.lanternRest.y;
    } else if (target) {
      // Rescale the free position proportionally and keep the target.
      this.rise.xFree = (this.rise.xFree / oldW) * layout.width;
      this.rise.target = target;
      const span = Math.max(1, this.rise.startY - this.rise.target.y);
      this.rise.startY = layout.lanternRest.y;
      this.rise.y = this.rise.startY - this.rise.p * span;
    }
  }

  /**
   * Advance by dt seconds. Returns true once the lantern has settled at its sky
   * point and should hand off to the sky layer.
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
      // Resting over the dock: the same sway formula as the rise, so release doesn't pop.
      const rest = this.layout.lanternRest;
      const sway = swayAmp * Math.sin(tSec * 0.8 + this.swayPhase) + swayAmp * 0.4 * Math.sin(tSec * 1.7 + this.swayPhase * 2);
      this.x = rest.x + sway;
      this.y = rest.y + 0.6 * Math.sin(tSec * 0.5 + this.swayPhase);
    }
    const stage = sizeStage(this.phase === 'rising' ? this.rise.p : 0);
    if (stage !== this.stage) {
      this.stage = stage;
      this.applyTextures();
    } else if (stage === 'big') {
      this.applyTextures();
    } else {
      const t = stage === 'small' ? this.tex.small[this.frame % 2]! : this.tex.dot[this.frame % 2]!;
      this.aboveSprite.texture = t;
      this.nearSprite.texture = t;
    }
    this.place(tSec);
    if (handOff) this.phase = 'done';
    return handOff;
  }

  private applyTextures(): void {
    const t = this.stage === 'big' ? this.tex.bigFor(this.frame, this.fill) : this.stage === 'small' ? this.tex.small[this.frame % 2]! : this.tex.dot[this.frame % 2]!;
    this.aboveSprite.texture = t;
    this.nearSprite.texture = t;
  }

  private spriteSize(): { w: number; h: number } {
    return this.stage === 'big' ? { w: LANTERN_W, h: LANTERN_H } : this.stage === 'small' ? { w: SMALL_W, h: SMALL_H } : { w: DOT, h: DOT };
  }

  private place(tSec: number): void {
    const { w, h } = this.spriteSize();
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

    // Halo: about 4 lantern widths on the shore, shrinking to a sky-light halo of ~14 art px.
    const haloD = (LANTERN_W * 4 * (1 - p) + 14 * p) * css;
    this.halo.position.set(cx, cy);
    this.halo.width = haloD;
    this.halo.height = haloD;
    this.halo.alpha = 0.55 * lit * flicker;

    const coreD = (w * 1.6 + 2) * css;
    this.core.position.set(cx, cy + (this.stage === 'big' ? 4 * css : 0));
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
    this.streak.width = LANTERN_W * 2 * css * (1 - 0.5 * p);
    this.streak.height = LANTERN_W * 4 * css * (1 - 0.6 * p);
    this.streak.alpha = 0.4 * lit * overWater * Math.pow(1 - p, 1.5) * flicker;
  }

  destroy(): void {
    this.aboveSprite.destroy();
    this.nearSprite.destroy();
    this.halo.destroy();
    this.core.destroy();
    this.streak.destroy();
  }
}
