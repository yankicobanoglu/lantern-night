import { Container, Sprite } from 'pixi.js';
import { STAR_CROSS_FRACTION, STAR_CROSS_S, STAR_FADE_S, STAR_HEAD_PX, STAR_LINGER_S, STAR_TRAIL_PX, STAR_TWINKLE_S } from '../config';
import type { Layout } from '../engine/layout';
import { radialGlowTexture, trailTexture } from '../engine/lightTextures';
import type { MotionLevel } from '../engine/motion';
import { PALETTE } from '../palette';
import { createRng } from '../engine/rng';

export type StarPath = { x0: number; y0: number; x1: number; y1: number };

type Phase = 'none' | 'twinkle' | 'cross' | 'fade' | 'linger';

/**
 * One shooting star in the light layer (SPEC section 7, Legibility): a 0.3 s
 * twinkle at the spawn point, a 9 px head with a soft glow and an 80 px tapered
 * trail crossing 40 % of the width in 1.4 s easing out, a 0.6 s fade, then 0.6 s
 * more of being tappable. All positions are CSS px.
 */
export class ShootingStar {
  readonly container = new Container();
  private readonly glow: Sprite;
  private readonly core: Sprite;
  private readonly trail: Sprite;
  private phase: Phase = 'none';
  private t = 0;
  private path: StarPath = { x0: 0, y0: 0, x1: 0, y1: 0 };
  private headPos = { x: 0, y: 0 };
  /** Set by the session when the star is tapped. */
  tapped = false;
  motion: MotionLevel = 'full';

  constructor(private layout: Layout) {
    this.glow = new Sprite(radialGlowTexture(128, PALETTE.star, 0.9));
    this.core = new Sprite(radialGlowTexture(64, PALETTE.star, 1));
    this.trail = new Sprite(trailTexture(256, 24, PALETTE.star));
    this.glow.anchor.set(0.5);
    this.core.anchor.set(0.5);
    this.trail.anchor.set(1, 0.5);
    for (const s of [this.trail, this.glow, this.core]) s.blendMode = 'add';
    this.container.addChild(this.trail, this.glow, this.core);
    this.container.visible = false;
  }

  get active(): boolean {
    return this.phase !== 'none';
  }

  /** Head position while the star can still be tapped (visible or lingering), else null. */
  head(): { x: number; y: number } | null {
    if (this.phase === 'none' || this.phase === 'twinkle' || this.tapped) return null;
    return { x: this.headPos.x, y: this.headPos.y };
  }

  /** Slower with reduced motion, but it still appears. */
  private slow(): number {
    return this.motion === 'gentle' ? 2 : 1;
  }

  spawn(path: StarPath): void {
    this.path = path;
    this.phase = 'twinkle';
    this.t = 0;
    this.tapped = false;
    this.headPos = { x: path.x0, y: path.y0 };
    this.container.visible = true;
    this.container.alpha = 1;
    const angle = Math.atan2(path.y1 - path.y0, path.x1 - path.x0);
    this.trail.rotation = angle;
    this.trail.visible = false;
    this.draw(0);
  }

  /** Advance by dt seconds. Returns true on the frame the star finishes untapped. */
  update(dt: number): boolean {
    if (this.phase === 'none') return false;
    const s = this.slow();
    this.t += dt;
    const headPx = STAR_HEAD_PX;
    switch (this.phase) {
      case 'twinkle': {
        const u = Math.min(1, this.t / (STAR_TWINKLE_S * s));
        const pulse = Math.sin(u * Math.PI);
        this.core.width = this.core.height = headPx * (0.6 + 1.2 * pulse);
        this.core.alpha = 0.6 + 0.4 * pulse;
        this.glow.width = this.glow.height = headPx * 3 * pulse;
        this.glow.alpha = 0.5 * pulse;
        this.core.position.set(this.path.x0, this.path.y0);
        this.glow.position.copyFrom(this.core.position);
        if (u >= 1) {
          this.phase = 'cross';
          this.t = 0;
          this.trail.visible = true;
        }
        return false;
      }
      case 'cross': {
        const u = Math.min(1, this.t / (STAR_CROSS_S * s));
        this.draw(1 - Math.pow(1 - u, 2.2));
        if (u >= 1) {
          this.phase = 'fade';
          this.t = 0;
        }
        return false;
      }
      case 'fade': {
        const u = Math.min(1, this.t / (STAR_FADE_S * s));
        // Drift a little further while fading.
        this.draw(1 + 0.08 * u);
        this.container.alpha = 1 - u;
        if (u >= 1) {
          this.phase = 'linger';
          this.t = 0;
          this.container.visible = false;
        }
        return false;
      }
      case 'linger': {
        if (this.t >= STAR_LINGER_S) {
          const untapped = !this.tapped;
          this.phase = 'none';
          return untapped;
        }
        return false;
      }
      default:
        return false;
    }
  }

  /** Called on tap: hide the star right away (the DOM sparkle takes over). */
  end(): void {
    this.tapped = true;
    this.container.visible = false;
    this.phase = 'none';
  }

  /** The light layer is in CSS px (the stage resolution handles device px). */
  private draw(p: number): void {
    const x = this.path.x0 + (this.path.x1 - this.path.x0) * p;
    const y = this.path.y0 + (this.path.y1 - this.path.y0) * p;
    this.headPos = { x, y };
    const headPx = STAR_HEAD_PX;
    this.core.position.set(x, y);
    this.core.width = this.core.height = headPx * 1.6;
    this.core.alpha = 1;
    this.glow.position.set(x, y);
    this.glow.width = this.glow.height = headPx * 4.5;
    this.glow.alpha = 0.55;
    // The trail grows in over the first part of the crossing.
    const len = STAR_TRAIL_PX * Math.min(1, p * 3);
    this.trail.position.set(x, y);
    this.trail.width = Math.max(1, len);
    this.trail.height = headPx * 1.4;
    this.trail.alpha = 0.85;
  }

  resize(layout: Layout): void {
    this.layout = layout;
    void this.layout;
  }
}

export type StarAvoid = { x: number; y: number; r: number };

/**
 * Choose a path in the clear upper sky (CSS px): 40 % of the width, a gentle
 * slope, never through the moon's halo, the bottom third or any active lantern.
 * Returns null when nothing fits (try again later).
 */
export function pickStarPath(layout: Layout, seed: number, avoid: StarAvoid[]): StarPath | null {
  const rng = createRng(seed);
  const css = layout.cssScale;
  const W = layout.width * css;
  const skyH = layout.horizon * css;
  const len = W * STAR_CROSS_FRACTION;
  // Keep clear of the disc and its halo (the disc is 32 art px; the halo fades within about one disc width).
  const moon = { x: layout.moon.x * css, y: layout.moon.y * css, r: 32 * css * 1.1 };
  const zones = [moon, ...avoid];
  for (let attempt = 0; attempt < 40; attempt++) {
    const dir = rng.next() < 0.5 ? 1 : -1;
    const slope = rng.range(0.12, 0.3);
    // Below the title band at the top, above the horizon glow.
    const y0 = rng.range(skyH * 0.18, skyH * 0.55);
    const dy = len * slope;
    if (y0 + dy > skyH * 0.7) continue;
    const x0 = dir > 0 ? rng.range(W * 0.05, W * 0.95 - len) : rng.range(W * 0.05 + len, W * 0.95);
    const path = { x0, y0, x1: x0 + dir * len, y1: y0 + dy };
    if (zones.some((z) => segmentDistance(path, z.x, z.y) < z.r)) continue;
    return path;
  }
  return null;
}

function segmentDistance(p: StarPath, x: number, y: number): number {
  const dx = p.x1 - p.x0;
  const dy = p.y1 - p.y0;
  const l2 = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((x - p.x0) * dx + (y - p.y0) * dy) / l2));
  return Math.hypot(x - (p.x0 + t * dx), y - (p.y0 + t * dy));
}
