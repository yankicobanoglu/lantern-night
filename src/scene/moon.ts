import { Container, Sprite, Texture } from 'pixi.js';
import { radialGlowTexture } from '../engine/lightTextures';
import type { Layout } from '../engine/layout';
import { PALETTE } from '../palette';
import { litFraction, type MoonFrame } from '../ritual/moonPhase';
import { MOON_SIZE, moonBuffer } from './sprites/moon';

/** Moon disc in the pixel layer, halo in the light layer. */
export class Moon {
  readonly sprite: Sprite;
  readonly halo: Sprite;
  private frames: Texture[] = [];
  private frame: MoonFrame = 0;

  constructor(layout: Layout, private readonly lightLayer: Container) {
    for (let f = 0; f < 8; f++) this.frames.push(moonBuffer(f as MoonFrame).toTexture());
    this.sprite = new Sprite(this.frames[0]);
    this.halo = new Sprite(radialGlowTexture(256, PALETTE.moon, 0.55));
    this.halo.anchor.set(0.5);
    this.halo.blendMode = 'add';
    this.lightLayer.addChild(this.halo);
    this.place(layout);
  }

  setFrame(frame: MoonFrame): void {
    this.frame = frame;
    this.sprite.texture = this.frames[frame] ?? this.frames[0]!;
    const lit = litFraction(frame / 8);
    this.halo.alpha = 0.12 + 0.5 * lit;
  }

  get currentFrame(): MoonFrame {
    return this.frame;
  }

  place(layout: Layout): void {
    this.sprite.position.set(layout.moon.x - MOON_SIZE / 2, layout.moon.y - MOON_SIZE / 2);
    const css = layout.cssScale;
    this.halo.position.set(layout.moon.x * css, layout.moon.y * css);
    const diameter = MOON_SIZE * css;
    this.halo.width = diameter * 3.2;
    this.halo.height = diameter * 3.2;
  }
}
