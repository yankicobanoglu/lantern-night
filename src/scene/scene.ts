import { Sprite, type Container, type Renderer } from 'pixi.js';
import { SLOW_TICK_HZ } from '../config';
import type { Layout } from '../engine/layout';
import type { MotionLevel } from '../engine/motion';
import { Pipeline } from '../engine/pipeline';
import { PixelBuffer } from '../engine/pixelBuffer';
import { hash01 } from '../engine/rng';
import { SlowTick } from '../engine/ticker';
import { PALETTE } from '../palette';
import type { MoonFrame } from '../ritual/moonPhase';
import { Cozy } from './cozy';
import { Fireflies } from './fireflies';
import { drawHills, type Window } from './hills';
import { Lake } from './lake';
import { LanternField } from './lanterns';
import { Moon } from './moon';
import { drawShore } from './shore';
import { ShootingStar } from './shootingStar';
import { drawSky, type Star } from './sky';
import { SkyLights } from './skyLights';

export class Scene {
  readonly pipeline: Pipeline;
  readonly moon: Moon;
  readonly lanterns: LanternField;
  readonly skyLights: SkyLights;
  readonly fireflies: Fireflies;
  readonly cozy: Cozy;
  readonly star: ShootingStar;
  /** Time multiplier for the animated parts (test hook; 1 in normal use). */
  speed = 1;
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

  constructor(renderer: Renderer, stage: Container, layout: Layout, readonly seed: number, motion: MotionLevel) {
    this.layout = layout;
    this.pipeline = new Pipeline(renderer, stage, layout);
    this.staticBuf = new PixelBuffer(1, 1);
    this.overlayBuf = new PixelBuffer(1, 1);
    this.shoreBuf = new PixelBuffer(1, 1);
    this.staticSprite = new Sprite();
    this.overlaySprite = new Sprite();
    this.shoreSprite = new Sprite();
    this.moon = new Moon(layout, this.pipeline.light);
    this.skyLights = new SkyLights(layout);
    this.lanterns = new LanternField(layout, seed);
    this.lanterns.motion = motion;
    this.lanterns.existingSky = () => this.skyLights.points;
    this.lanterns.onHandOff = (h) => this.skyLights.add({ seed: h.seed, sky: h.sky, status: 'rising', ...(h.id ? { id: h.id } : {}) });
    this.fireflies = new Fireflies(layout, seed, motion);
    this.cozy = new Cozy(layout, seed);
    this.star = new ShootingStar(layout);
    this.star.motion = motion;

    // Pixel layers, back to front.
    this.pipeline.above.addChild(this.staticSprite, this.overlaySprite, this.cozy.smokeSprite, this.skyLights.sprite, this.moon.sprite, this.lanterns.aboveLayer);
    this.lake = new Lake(layout, this.pipeline.aboveRT);
    this.pipeline.world.addChild(this.lake.container, this.cozy.boatSprite, this.lanterns.nearLayer, this.shoreSprite, this.fireflies.sprite);
    // Light layer: sky halos under the lanterns' own light, fireflies on top.
    this.pipeline.light.addChild(this.cozy.light, this.skyLights.halos, this.lanterns.lightLayer, this.fireflies.light, this.star.container);

    this.slow = new SlowTick(SLOW_TICK_HZ, (t) => this.slowTick(t));
    this.build(layout);
  }

  build(layout: Layout): void {
    this.staticBuf.destroy();
    this.overlayBuf.destroy();
    this.shoreBuf.destroy();

    this.staticBuf = new PixelBuffer(layout.width, layout.hillsEnd);
    this.stars = drawSky(this.staticBuf, layout, this.seed);
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

  /** Settings or the system changed the motion level. */
  setMotion(motion: MotionLevel): void {
    this.lanterns.motion = motion;
    this.star.motion = motion;
    this.fireflies.build(this.layout, motion);
  }

  resize(layout: Layout, motion: MotionLevel): void {
    this.layout = layout;
    this.pipeline.resize(layout);
    this.star.resize(layout);
    this.lake.build(layout, this.pipeline.aboveRT);
    this.skyLights.resize(layout);
    this.lanterns.resize(layout);
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
    this.lanterns.update(dt / 1000, tSec);
    this.skyLights.update(tSec);
    this.fireflies.update(dt / 1000, tSec);
    this.cozy.update(tSec);
    this.starDone = this.star.update(dt / 1000);
    this.pipeline.render();
  }

  /** Tear down an offscreen scene (the share image builds one per render). Cached light textures are shared and kept. */
  destroy(): void {
    for (const l of [...this.lanterns.lanterns]) l.destroy();
    this.lanterns.lanterns.length = 0;
    this.lanterns.tex.destroy();
    this.staticBuf.destroy();
    this.overlayBuf.destroy();
    this.shoreBuf.destroy();
    this.skyLights.destroy();
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
    this.fireflies.drawTick(tick);
    this.cozy.drawTick(tick);
  }
}
