import { Container, Sprite } from 'pixi.js';
import { FIREFLY_COUNT } from '../config';
import type { Layout } from '../engine/layout';
import { radialGlowTexture } from '../engine/lightTextures';
import type { MotionLevel } from '../engine/motion';
import type { QualityLevel } from '../engine/quality';
import { PixelBuffer } from '../engine/pixelBuffer';
import { createRng, hash01 } from '../engine/rng';
import { PALETTE } from '../palette';

type Firefly = { x: number; y: number; vx: number; vy: number; phase: number; period: number; halo: Sprite };

/**
 * Fireflies among the reeds (SPEC section 7): 1–2 px in the firefly colour,
 * wandering slowly, each blinking on for ~1.5 s then resting a few seconds.
 * Pixels are drawn on the slow tick; the tiny halos follow the float position.
 */
export class Fireflies {
  readonly sprite: Sprite;
  readonly light = new Container();
  private buf: PixelBuffer;
  private flies: Firefly[] = [];
  private top = 0;
  private motion: MotionLevel;
  private quality: QualityLevel = 3;

  constructor(private layout: Layout, private readonly seed: number, motion: MotionLevel) {
    this.motion = motion;
    this.buf = new PixelBuffer(1, 1);
    this.sprite = new Sprite();
    this.light.blendMode = 'add';
    this.build(layout, motion);
  }

  build(layout: Layout, motion: MotionLevel): void {
    this.layout = layout;
    this.motion = motion;
    for (const f of this.flies) f.halo.destroy();
    this.flies = [];
    this.buf.destroy();
    this.top = layout.lakeEnd - 14;
    this.buf = new PixelBuffer(layout.width, layout.height - this.top);
    this.sprite.texture = this.buf.toTexture();
    this.sprite.position.set(0, this.top);

    const rng = createRng(this.seed + 500);
    // Fewer particles (quality 2 and below) uses the gentle count; the halos go too.
    const count = motion === 'gentle' || this.quality < 3 ? Math.ceil(FIREFLY_COUNT / 2) : FIREFLY_COUNT;
    this.light.visible = this.quality >= 3;
    const tex = radialGlowTexture(64, PALETTE.firefly, 0.8);
    for (let i = 0; i < count; i++) {
      // Keep them clear of the lantern's spot and mostly near the reeds on both sides.
      const side = rng.next() < 0.5 ? -1 : 1;
      const x = layout.centreX + side * (14 + rng.next() * (layout.width / 2 - 18));
      const y = layout.lakeEnd - 10 + rng.next() * 14;
      const halo = new Sprite(tex);
      halo.anchor.set(0.5);
      halo.blendMode = 'add';
      this.light.addChild(halo);
      this.flies.push({ x, y, vx: 0, vy: 0, phase: rng.next() * 10, period: 3.5 + rng.next() * 3, halo });
    }
  }

  setQuality(level: QualityLevel): void {
    if (level === this.quality) return;
    this.quality = level;
    this.build(this.layout, this.motion);
  }

  /** Test hook. */
  report(): { count: number; halos: boolean } {
    return { count: this.flies.length, halos: this.light.visible };
  }

  /** Brightness envelope 0–1: on for ~1.5 s of each period, soft in and out. */
  private glow(f: Firefly, tSec: number): number {
    const t = (tSec + f.phase) % f.period;
    if (t > 1.5) return 0;
    return Math.sin((t / 1.5) * Math.PI);
  }

  update(dt: number, tSec: number): void {
    const css = this.layout.cssScale;
    for (let i = 0; i < this.flies.length; i++) {
      const f = this.flies[i]!;
      // Slow wander: velocity nudged by noise, bounded to the reeds band.
      f.vx += (hash01(Math.floor(tSec * 2) + i * 17, 31) - 0.5) * 3 * dt;
      f.vy += (hash01(Math.floor(tSec * 2) + i * 17, 37) - 0.5) * 2 * dt;
      f.vx *= 1 - 0.6 * dt;
      f.vy *= 1 - 0.6 * dt;
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      if (f.y < this.layout.lakeEnd - 12) f.vy += 0.5 * dt;
      if (f.y > this.layout.height - 3) f.vy -= 0.5 * dt;
      if (Math.abs(f.x - this.layout.centreX) < 12) f.vx += Math.sign(f.x - this.layout.centreX) * 0.8 * dt;
      f.x = Math.max(1, Math.min(this.layout.width - 2, f.x));
      const g = this.glow(f, tSec);
      f.halo.position.set(f.x * css, f.y * css);
      const d = 7 * css;
      f.halo.width = d;
      f.halo.height = d;
      f.halo.alpha = 0.5 * g;
    }
  }

  drawTick(tick: number): void {
    const tSec = tick / 10;
    this.buf.clear();
    for (const f of this.flies) {
      const g = this.glow(f, tSec);
      if (g < 0.15) continue;
      const x = Math.round(f.x);
      const y = Math.round(f.y) - this.top;
      this.buf.set(x, y, PALETTE.firefly);
      if (g > 0.8) this.buf.set(x + 1, y, PALETTE.firefly);
    }
    this.buf.upload();
  }
}
