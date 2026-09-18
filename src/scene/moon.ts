import { Container, Sprite, Texture } from 'pixi.js';
import { radialGlowTexture } from '../engine/lightTextures';
import type { Layout } from '../engine/layout';
import type { QualityLevel } from '../engine/quality';
import { PALETTE } from '../palette';
import { litFraction, type MoonFrame } from '../ritual/moonPhase';
import { MOON_SIZE, moonBuffer, SUPERMOON_SIZE } from './sprites/moon';

/** Moon disc in the pixel layer, halo in the light layer. */
export class Moon {
  readonly sprite: Sprite;
  readonly halo: Sprite;
  private frames: Texture[] = [];
  private frame: MoonFrame = 0;
  private supermoon = false;
  private layout: Layout;

  constructor(layout: Layout, private readonly lightLayer: Container) {
    this.layout = layout;
    this.buildFrames();
    this.sprite = new Sprite(this.frames[0]);
    this.halo = new Sprite(radialGlowTexture(256, PALETTE.moon, 0.55));
    this.halo.anchor.set(0.5);
    this.halo.blendMode = 'add';
    this.lightLayer.addChild(this.halo);
    this.place(layout);
  }

  /** Disc size in art px: 32, or 36 on a supermoon night (ROADMAP 4.6). */
  get size(): number {
    return this.supermoon ? SUPERMOON_SIZE : MOON_SIZE;
  }

  private buildFrames(): void {
    for (const f of this.frames) f.destroy(true);
    this.frames = [];
    for (let f = 0; f < 8; f++) this.frames.push(moonBuffer(f as MoonFrame, this.size).toTexture());
  }

  setFrame(frame: MoonFrame): void {
    this.frame = frame;
    this.sprite.texture = this.frames[frame] ?? this.frames[0]!;
    const lit = litFraction(frame / 8);
    this.halo.alpha = 0.12 + 0.5 * lit;
  }

  /** A supermoon is drawn a little larger: a 36 px disc on the same grid, never a scaled sprite. */
  setSupermoon(on: boolean): void {
    if (on === this.supermoon) return;
    this.supermoon = on;
    this.buildFrames();
    this.setFrame(this.frame);
    this.place(this.layout);
  }

  get isSupermoon(): boolean {
    return this.supermoon;
  }

  /** No bloom: the halo goes; the disc stays. */
  setQuality(level: QualityLevel): void {
    this.halo.visible = level >= 2;
  }

  destroy(): void {
    for (const f of this.frames) f.destroy(true);
    this.frames = [];
    this.halo.destroy();
    this.sprite.destroy();
  }

  get currentFrame(): MoonFrame {
    return this.frame;
  }

  place(layout: Layout): void {
    this.layout = layout;
    const size = this.size;
    this.sprite.position.set(layout.moon.x - size / 2, layout.moon.y - size / 2);
    const css = layout.cssScale;
    this.halo.position.set(layout.moon.x * css, layout.moon.y * css);
    const diameter = size * css;
    this.halo.width = diameter * 3.2;
    this.halo.height = diameter * 3.2;
  }
}
