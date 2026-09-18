import { Texture } from 'pixi.js';
import { PixelBuffer } from '../engine/pixelBuffer';
import type { SceneKind } from './field';
import {
  DOT,
  FRAMES,
  LANTERN_H,
  LANTERN_W,
  LARGE_H,
  LARGE_PAPER_ROWS,
  LARGE_W,
  LIT_PALETTE,
  largeLanternMaps,
  PAPER_ROWS,
  SKY_LIGHT_PALETTE,
  SMALL_H,
  SMALL_W,
  UNLIT_PALETTE,
  lanternMaps,
  skyLightMap,
  smallLanternMap,
} from './sprites/lantern';
import {
  smallWaterLanternMap,
  WATER_BIG_H,
  WATER_BIG_W,
  WATER_FRAMES,
  WATER_LARGE_H,
  WATER_LARGE_W,
  WATER_LIT_PALETTE,
  WATER_PAPER,
  WATER_SMALL_H,
  WATER_SMALL_W,
  WATER_UNLIT_PALETTE,
  waterLanternMaps,
} from './sprites/waterLantern';

export type StageName = 'large' | 'big' | 'small' | 'dot';
export type StageSize = { w: number; h: number };

/**
 * Baked nearest-neighbour textures for every frame and fill level of one
 * lantern kind, plus the sprite sizes the lantern needs to place itself.
 * Built once per kind and shared by every scene (ROADMAP 2.5): never destroyed.
 */
export type LanternSpriteSet = {
  kind: SceneKind;
  sizes: Record<StageName, StageSize>;
  /** Where the core bloom sits relative to the sprite centre, art px down (the flame's height). */
  coreDy: Record<StageName, number>;
  largeFor(frame: number, fill: number): Texture;
  bigFor(frame: number, fill: number): Texture;
  small: readonly Texture[];
  dot: readonly Texture[];
};

function bake(w: number, h: number, maps: { unlit: readonly string[]; lit: readonly string[] }, unlitPalette: Readonly<Record<string, number>>, litPalette: Readonly<Record<string, number>>): Texture {
  const buf = new PixelBuffer(w, h);
  buf.blit(maps.unlit, unlitPalette, 0, 0);
  buf.blit(maps.lit, litPalette, 0, 0);
  return buf.toTexture();
}

function dots(): Texture[] {
  const out: Texture[] = [];
  for (let f = 0; f < 2; f++) {
    const buf = new PixelBuffer(DOT, DOT);
    buf.blit(skyLightMap('rising', f), SKY_LIGHT_PALETTE, 0, 0);
    out.push(buf.toTexture());
  }
  return out;
}

/** The sky lantern (SPEC section 7): 26×34 at rest, 18×24, 9×12, then the 4×4 dot. */
function skyLanternSet(): LanternSpriteSet {
  const large: Texture[][] = [];
  const big: Texture[][] = [];
  for (let f = 0; f < FRAMES; f++) {
    large.push(Array.from({ length: LARGE_PAPER_ROWS + 1 }, (_, lit) => bake(LARGE_W, LARGE_H, largeLanternMaps(f, lit / LARGE_PAPER_ROWS), UNLIT_PALETTE, LIT_PALETTE)));
    big.push(Array.from({ length: PAPER_ROWS + 1 }, (_, lit) => bake(LANTERN_W, LANTERN_H, lanternMaps(f, lit / PAPER_ROWS), UNLIT_PALETTE, LIT_PALETTE)));
  }
  const small: Texture[] = [];
  for (let f = 0; f < 2; f++) {
    const buf = new PixelBuffer(SMALL_W, SMALL_H);
    buf.blit(smallLanternMap(f), LIT_PALETTE, 0, 0);
    small.push(buf.toTexture());
  }
  const clamp = (fill: number): number => Math.max(0, Math.min(1, fill));
  return {
    kind: 'sky',
    sizes: { large: { w: LARGE_W, h: LARGE_H }, big: { w: LANTERN_W, h: LANTERN_H }, small: { w: SMALL_W, h: SMALL_H }, dot: { w: DOT, h: DOT } },
    coreDy: { large: 6, big: 4, small: 0, dot: 0 },
    largeFor: (frame, fill) => large[frame % FRAMES]?.[Math.round(clamp(fill) * LARGE_PAPER_ROWS)] ?? Texture.EMPTY,
    bigFor: (frame, fill) => big[frame % FRAMES]?.[Math.round(clamp(fill) * PAPER_ROWS)] ?? Texture.EMPTY,
    small,
    dot: dots(),
  };
}

/** The water lantern (ROADMAP 4.1): 20×15 at rest, 14×10, 7×5, then the same 4×4 dot. */
function waterLanternSet(): LanternSpriteSet {
  const large: Texture[][] = [];
  const big: Texture[][] = [];
  for (let f = 0; f < WATER_FRAMES; f++) {
    large.push(Array.from({ length: WATER_PAPER.large.rows + 1 }, (_, lit) => bake(WATER_LARGE_W, WATER_LARGE_H, waterLanternMaps(f, lit / WATER_PAPER.large.rows, 'large'), WATER_UNLIT_PALETTE, WATER_LIT_PALETTE)));
    big.push(Array.from({ length: WATER_PAPER.big.rows + 1 }, (_, lit) => bake(WATER_BIG_W, WATER_BIG_H, waterLanternMaps(f, lit / WATER_PAPER.big.rows, 'big'), WATER_UNLIT_PALETTE, WATER_LIT_PALETTE)));
  }
  const small: Texture[] = [];
  for (let f = 0; f < 2; f++) {
    const buf = new PixelBuffer(WATER_SMALL_W, WATER_SMALL_H);
    buf.blit(smallWaterLanternMap(f), WATER_LIT_PALETTE, 0, 0);
    small.push(buf.toTexture());
  }
  const clamp = (fill: number): number => Math.max(0, Math.min(1, fill));
  return {
    kind: 'water',
    sizes: { large: { w: WATER_LARGE_W, h: WATER_LARGE_H }, big: { w: WATER_BIG_W, h: WATER_BIG_H }, small: { w: WATER_SMALL_W, h: WATER_SMALL_H }, dot: { w: DOT, h: DOT } },
    coreDy: { large: -1, big: -1, small: 0, dot: 0 },
    largeFor: (frame, fill) => large[frame % WATER_FRAMES]?.[Math.round(clamp(fill) * WATER_PAPER.large.rows)] ?? Texture.EMPTY,
    bigFor: (frame, fill) => big[frame % WATER_FRAMES]?.[Math.round(clamp(fill) * WATER_PAPER.big.rows)] ?? Texture.EMPTY,
    small,
    dot: dots(),
  };
}

const sets = new Map<SceneKind, LanternSpriteSet>();

/** The shared sprite set for a scene kind, built on first use. */
export function lanternSpriteSet(kind: SceneKind): LanternSpriteSet {
  let set = sets.get(kind);
  if (!set) {
    set = kind === 'water' ? waterLanternSet() : skyLanternSet();
    sets.set(kind, set);
  }
  return set;
}
