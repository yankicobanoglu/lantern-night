import { Particle, ParticleContainer, Sprite } from 'pixi.js';
import { MAX_SKY } from '../config';
import { radialGlowTexture } from '../engine/lightTextures';
import { PixelBuffer } from '../engine/pixelBuffer';
import type { QualityLevel } from '../engine/quality';
import { hash01 } from '../engine/rng';
import { PALETTE } from '../palette';
import type { Field, LanternKind } from './field';
import type { SkyPoint } from './skyPoint';
import { SKY_LIGHT_PALETTE, skyLightMap, type SkyStatus } from './sprites/lantern';
import { waterLightMap, WATER_LIGHT_H, WATER_LIGHT_PALETTE, WATER_LIGHT_W } from './sprites/waterLight';

export type SkyLight = { seed: number; sky: SkyPoint; status: SkyStatus; kind: LanternKind; id?: string };

/**
 * Past lanterns as small warm lights (SPEC section 7 "Stars vs past lanterns"):
 * ≥ 2×2 art px in the lantern colour with a slow bob, drawn on the slow tick
 * into a pixel overlay; a tiny additive halo per light in a particle container.
 * One of these exists per kind (M7) and each holds only its own: sky lights in
 * the sky band above the horizon, water lights on the far half of the lake,
 * with their own flatter shape and reflection.
 */
export class SkyLights {
  readonly sprite: Sprite;
  readonly halos: ParticleContainer;
  readonly lights: SkyLight[] = [];
  private buf: PixelBuffer;
  private particles: Particle[] = [];
  private lastTick = 0;

  constructor(
    private field: Field,
    private cssScale: number,
  ) {
    this.buf = new PixelBuffer(field.width, field.height);
    this.sprite = new Sprite(this.buf.toTexture());
    this.sprite.position.set(0, field.top);
    this.halos = new ParticleContainer({
      dynamicProperties: { position: true, alpha: true, scale: false, rotation: false, color: false, vertex: false },
      texture: radialGlowTexture(64, PALETTE.glow, 0.8),
      blendMode: 'add',
    });
  }

  get points(): readonly SkyPoint[] {
    return this.lights.map((l) => l.sky);
  }

  get kind(): LanternKind {
    return this.field.kind;
  }

  /** Add a light of this set's kind (the kind is stamped, so a caller cannot file one in the wrong field). */
  add(light: SkyLight): void {
    light = { ...light, kind: this.field.kind };
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

  /** Below full quality the additive halos go; the ≥ 2×2 warm dots stay legible on their own. */
  setQuality(level: QualityLevel): void {
    this.halos.visible = level >= 3;
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

  /** Vertical bob in art px: a slow drift in the sky, a smaller rock on the water. */
  private bob(i: number, tSec: number): number {
    const l = this.lights[i]!;
    const amp = this.field.kind === 'water' ? 0.5 : 0.9;
    return Math.sin(tSec * 0.35 + hash01(l.seed, 21) * Math.PI * 2) * amp;
  }

  /** Top-left of the light in the field's own buffer (art px), and the size it covers. */
  private art(i: number): { x: number; y: number; w: number; h: number } {
    const l = this.lights[i]!;
    if (this.field.kind === 'water') {
      // Wider than tall, and the reflection hangs below the light itself.
      const w = WATER_LIGHT_W;
      const h = WATER_LIGHT_H;
      return { x: Math.round(l.sky.x * this.field.width - w / 2), y: Math.round(l.sky.y * this.field.height - 1), w, h };
    }
    const size = l.status === 'came-true' ? 5 : 4;
    return { x: Math.round(l.sky.x * this.field.width - size / 2), y: Math.round(l.sky.y * this.field.height - size / 2), w: size, h: size };
  }

  private placeHalo(i: number, tSec: number): void {
    const p = this.particles[i];
    const l = this.lights[i];
    if (!p || !l) return;
    const css = this.cssScale;
    const { x, y, w } = this.art(i);
    // The halo sits on the light, not on the reflection below it.
    const d = (l.status === 'came-true' ? 18 : 14) * css;
    p.scaleX = d / 64;
    p.scaleY = d / 64;
    p.x = (x + w / 2) * css;
    p.y = (this.field.top + y + (this.field.kind === 'water' ? 1.5 : w / 2) + this.bob(i, tSec)) * css;
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
      const water = this.field.kind === 'water';
      const map = water ? waterLightMap(l.status, twinkle) : skyLightMap(l.status, twinkle);
      this.buf.blit(map, water ? WATER_LIGHT_PALETTE : SKY_LIGHT_PALETTE, x, y + Math.round(this.bob(i, tSec)));
    }
    this.buf.upload();
  }

  destroy(): void {
    this.clear();
    this.buf.destroy();
    this.halos.destroy();
    this.sprite.destroy();
  }

  resize(field: Field, cssScale: number): void {
    this.field = field;
    this.cssScale = cssScale;
    this.buf.destroy();
    this.buf = new PixelBuffer(field.width, field.height);
    this.sprite.texture = this.buf.toTexture();
    this.sprite.position.set(0, field.top);
    this.drawTick(this.lastTick);
    this.update(0);
  }
}
