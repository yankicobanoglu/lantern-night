import { Particle, ParticleContainer, Sprite } from 'pixi.js';
import { MAX_SKY } from '../config';
import type { Layout } from '../engine/layout';
import { radialGlowTexture } from '../engine/lightTextures';
import { PixelBuffer } from '../engine/pixelBuffer';
import { hash01 } from '../engine/rng';
import { PALETTE } from '../palette';
import type { SkyPoint } from './skyPoint';
import { SKY_LIGHT_PALETTE, skyLightMap, type SkyStatus } from './sprites/lantern';

export type SkyLight = { seed: number; sky: SkyPoint; status: SkyStatus; id?: string };

/**
 * Past lanterns as small warm lights (SPEC section 7 "Stars vs past lanterns"):
 * ≥ 2×2 art px in the lantern colour with a slow bob, drawn on the slow tick
 * into a pixel overlay; a tiny additive halo per light in a particle container.
 */
export class SkyLights {
  readonly sprite: Sprite;
  readonly halos: ParticleContainer;
  readonly lights: SkyLight[] = [];
  private buf: PixelBuffer;
  private particles: Particle[] = [];
  private lastTick = 0;

  constructor(private layout: Layout) {
    this.buf = new PixelBuffer(layout.width, layout.horizon);
    this.sprite = new Sprite(this.buf.toTexture());
    this.halos = new ParticleContainer({
      dynamicProperties: { position: true, alpha: true, scale: false, rotation: false, color: false, vertex: false },
      texture: radialGlowTexture(64, PALETTE.glow, 0.8),
      blendMode: 'add',
    });
  }

  get points(): readonly SkyPoint[] {
    return this.lights.map((l) => l.sky);
  }

  add(light: SkyLight): void {
    if (this.lights.length >= MAX_SKY) {
      // P1 (M5): the oldest merge into a haze. For now the oldest light is dropped.
      this.lights.shift();
      const old = this.particles.shift();
      if (old) this.halos.removeParticle(old);
    }
    this.lights.push(light);
    const p = new Particle({ texture: this.halos.texture, anchorX: 0.5, anchorY: 0.5 });
    this.particles.push(p);
    this.halos.addParticle(p);
    this.placeHalo(this.lights.length - 1, 0);
    this.drawTick(this.lastTick);
  }

  /** A return changed a stored lantern's status: brighter and larger when it came true, dimmer when let go. */
  setStatus(id: string, status: SkyStatus): void {
    const i = this.lights.findIndex((l) => l.id === id);
    if (i < 0) return;
    this.lights[i]!.status = status;
    this.placeHalo(i, 0);
    this.drawTick(this.lastTick);
  }

  clear(): void {
    for (const p of this.particles) this.halos.removeParticle(p);
    this.particles = [];
    this.lights.length = 0;
    this.drawTick(this.lastTick);
  }

  private bob(i: number, tSec: number): number {
    const l = this.lights[i]!;
    return Math.sin(tSec * 0.35 + hash01(l.seed, 21) * Math.PI * 2) * 0.9;
  }

  private art(i: number): { x: number; y: number; size: number } {
    const l = this.lights[i]!;
    const size = l.status === 'came-true' ? 5 : 4;
    return { x: Math.round(l.sky.x * this.layout.width - size / 2), y: Math.round(l.sky.y * this.layout.horizon - size / 2), size };
  }

  private placeHalo(i: number, tSec: number): void {
    const p = this.particles[i];
    const l = this.lights[i];
    if (!p || !l) return;
    const css = this.layout.cssScale;
    const { x, y, size } = this.art(i);
    const d = (size === 5 ? 18 : 14) * css;
    p.scaleX = d / 64;
    p.scaleY = d / 64;
    p.x = (x + size / 2) * css;
    p.y = (y + size / 2 + this.bob(i, tSec)) * css;
    p.alpha = l.status === 'let-go' ? 0.3 : l.status === 'came-true' ? 0.9 : 0.7;
  }

  /** Per frame: halos follow the (float) bob. */
  update(tSec: number): void {
    for (let i = 0; i < this.lights.length; i++) this.placeHalo(i, tSec);
  }

  /** Slow tick: redraw the pixel dots with a snapped bob and a soft twinkle. */
  drawTick(tick: number): void {
    this.lastTick = tick;
    const tSec = tick / 10;
    this.buf.clear();
    for (let i = 0; i < this.lights.length; i++) {
      const l = this.lights[i]!;
      const { x, y } = this.art(i);
      const twinkle = hash01(tick + i * 131, 27) > 0.75 ? 1 : 0;
      this.buf.blit(skyLightMap(l.status, twinkle), SKY_LIGHT_PALETTE, x, y + Math.round(this.bob(i, tSec)));
    }
    this.buf.upload();
  }

  resize(layout: Layout): void {
    this.layout = layout;
    this.buf.destroy();
    this.buf = new PixelBuffer(layout.width, layout.horizon);
    this.sprite.texture = this.buf.toTexture();
    this.drawTick(this.lastTick);
    this.update(0);
  }
}
