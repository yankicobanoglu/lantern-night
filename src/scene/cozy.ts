import { Container, Sprite } from 'pixi.js';
import type { Layout } from '../engine/layout';
import { radialGlowTexture, wispTexture } from '../engine/lightTextures';
import { PixelBuffer, type PixelMap } from '../engine/pixelBuffer';
import { hash01 } from '../engine/rng';
import { PALETTE } from '../palette';
import type { Chimney, Window } from './hills';

/** Rowing boat, moored on the near water, a small lamp at the bow. d: dark wood, w: wood, l: lamp. */
const BOAT: PixelMap = [
  'l..............',
  'w.............w',
  'wwdddddddddddww',
  '.wwwwwwwwwwwww.',
  '..ddddddddddd..',
];
const BOAT_PALETTE = { w: PALETTE.wood, d: PALETTE.woodDark, l: PALETTE.lantern } as const;

type Wisp = { sprite: Sprite; speed: number; y: number; phase: number; w: number };

/**
 * Cozy details added after the M2 review: chimney smoke from the cottages,
 * a moored rowing boat that rocks a pixel, drifting mist over the far water,
 * and a warm glow on every lit window.
 */
export class Cozy {
  /** Pixel overlay above the shoreline (smoke), drawn on the slow tick. */
  readonly smokeSprite: Sprite;
  /** Pixel sprite over the lake. */
  readonly boatSprite: Sprite;
  /** Light layer: window glows and mist. */
  readonly light = new Container();
  private smokeBuf = new PixelBuffer(1, 1);
  private boatBuf = new PixelBuffer(1, 1);
  private windowGlows: Sprite[] = [];
  private boatGlow: Sprite | null = null;
  private wisps: Wisp[] = [];
  private chimneys: Chimney[] = [];
  private boat = { x: 0, y: 0 };

  constructor(private layout: Layout, private readonly seed: number) {
    this.smokeSprite = new Sprite();
    this.boatSprite = new Sprite();
    this.light.blendMode = 'add';
  }

  build(layout: Layout, windows: Window[], chimneys: Chimney[]): void {
    this.layout = layout;
    this.chimneys = chimneys;

    this.smokeBuf.destroy();
    this.smokeBuf = new PixelBuffer(layout.width, layout.hillsEnd);
    this.smokeSprite.texture = this.smokeBuf.toTexture();

    // Boat: left of centre, on the near water, with a one-row reflection.
    this.boatBuf.destroy();
    this.boatBuf = new PixelBuffer(BOAT[0]!.length, BOAT.length + 2);
    this.boatBuf.blit(BOAT, BOAT_PALETTE, 0, 0);
    for (let x = 2; x < BOAT[0]!.length - 2; x += 2) this.boatBuf.set(x, BOAT.length + 1, PALETTE.woodDark);
    this.boatSprite.texture = this.boatBuf.toTexture();
    this.boat = { x: layout.centreX - Math.round(layout.width * (layout.landscape ? 0.16 : 0.3)), y: layout.lakeEnd - 10 };
    this.boatSprite.position.set(this.boat.x, this.boat.y);
    this.boatGlow?.destroy();
    this.boatGlow = new Sprite(radialGlowTexture(64, PALETTE.lantern, 0.8));
    this.boatGlow.anchor.set(0.5);
    this.boatGlow.blendMode = 'add';
    this.boatGlow.width = 10 * layout.cssScale;
    this.boatGlow.height = 10 * layout.cssScale;
    this.boatGlow.alpha = 0.45;
    this.light.addChild(this.boatGlow);

    for (const g of this.windowGlows) g.destroy();
    this.windowGlows = [];
    const glowTex = radialGlowTexture(64, PALETTE.lantern, 0.8);
    for (const w of windows) {
      const g = new Sprite(glowTex);
      g.anchor.set(0.5);
      g.blendMode = 'add';
      const css = layout.cssScale;
      g.position.set((w.x + w.w / 2) * css, (w.y + w.h / 2) * css);
      g.width = 12 * css;
      g.height = 12 * css;
      g.alpha = 0.4;
      this.light.addChild(g);
      this.windowGlows.push(g);
    }

    for (const w of this.wisps) w.sprite.destroy();
    this.wisps = [];
    const count = layout.landscape ? 5 : 3;
    for (let i = 0; i < count; i++) {
      const wisp = new Sprite(wispTexture(256, 64, PALETTE.moon, 0.9));
      wisp.anchor.set(0.5);
      wisp.blendMode = 'add';
      const w = (40 + hash01(i, this.seed + 201) * 40) * layout.cssScale;
      wisp.width = w;
      wisp.height = 10 * layout.cssScale;
      this.light.addChild(wisp);
      this.wisps.push({
        sprite: wisp,
        speed: (0.8 + hash01(i, this.seed + 202) * 1.2) * (hash01(i, this.seed + 203) < 0.5 ? -1 : 1),
        y: layout.hillsEnd + 2 + hash01(i, this.seed + 204) * 8,
        phase: hash01(i, this.seed + 205) * 20,
        w,
      });
    }
  }

  /** Per frame: mist drifts, window glow breathes. */
  update(tSec: number): void {
    const css = this.layout.cssScale;
    const span = this.layout.width * css + 2 * 60 * css;
    for (const w of this.wisps) {
      let x = ((w.phase * 30 + tSec * w.speed) * css) % span;
      if (x < 0) x += span;
      w.sprite.position.set(x - 60 * css, w.y * css + Math.sin(tSec * 0.3 + w.phase) * 1.5 * css);
      w.sprite.alpha = 0.3 + 0.1 * Math.sin(tSec * 0.5 + w.phase);
    }
    for (let i = 0; i < this.windowGlows.length; i++) {
      this.windowGlows[i]!.alpha = 0.36 + 0.06 * Math.sin(tSec * 1.7 + i * 2.1);
    }
  }

  /** Slow tick: smoke puffs rise and drift; the boat rocks one pixel. */
  drawTick(tick: number): void {
    this.smokeBuf.clear();
    for (let c = 0; c < this.chimneys.length; c++) {
      const ch = this.chimneys[c]!;
      const drift = c % 2 === 0 ? 1 : -1;
      for (let i = 0; i < 6; i++) {
        const age = (tick * 0.35 + i * 5 + c * 3) % 30; // 0 fresh … 30 gone
        if (age > 26) continue;
        // Older puffs thin out: draw only some ticks.
        if (age > 14 && hash01(Math.floor(age) + i * 11 + c, 41) < (age - 14) / 14) continue;
        const y = ch.y - Math.round(age * 0.55);
        const x = ch.x + Math.round(drift * age * 0.12 + Math.sin(age * 0.6 + i) * 0.9);
        this.smokeBuf.set(x, y, PALETTE.earthshine);
        if (age > 6 && age < 20) this.smokeBuf.set(x + (i % 2 === 0 ? 1 : -1), y, PALETTE.earthshine);
      }
    }
    this.smokeBuf.upload();
    const rock = Math.sin(tick * 0.18) > 0.5 ? 1 : 0;
    this.boatSprite.position.set(this.boat.x, this.boat.y + rock);
    if (this.boatGlow) {
      const css = this.layout.cssScale;
      this.boatGlow.position.set((this.boat.x + 0.5) * css, (this.boat.y + rock + 0.5) * css);
    }
  }
}
