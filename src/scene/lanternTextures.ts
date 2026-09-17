import { Texture } from 'pixi.js';
import { PixelBuffer } from '../engine/pixelBuffer';
import {
  DOT,
  FRAMES,
  LANTERN_H,
  LANTERN_W,
  LIT_PALETTE,
  PAPER_ROWS,
  SKY_LIGHT_PALETTE,
  SMALL_H,
  SMALL_W,
  UNLIT_PALETTE,
  lanternMaps,
  skyLightMap,
  smallLanternMap,
} from './sprites/lantern';

/** Baked nearest-neighbour textures for every lantern frame and fill level. Built once. */
export class LanternTextures {
  /** [frame][litRows] */
  readonly big: Texture[][] = [];
  readonly small: Texture[] = [];
  readonly dot: Texture[] = [];

  constructor() {
    for (let f = 0; f < FRAMES; f++) {
      const row: Texture[] = [];
      for (let lit = 0; lit <= PAPER_ROWS; lit++) {
        const buf = new PixelBuffer(LANTERN_W, LANTERN_H);
        const { unlit, lit: litMap } = lanternMaps(f, lit / PAPER_ROWS);
        buf.blit(unlit, UNLIT_PALETTE, 0, 0);
        buf.blit(litMap, LIT_PALETTE, 0, 0);
        row.push(buf.toTexture());
      }
      this.big.push(row);
    }
    for (let f = 0; f < 2; f++) {
      const buf = new PixelBuffer(SMALL_W, SMALL_H);
      buf.blit(smallLanternMap(f), LIT_PALETTE, 0, 0);
      this.small.push(buf.toTexture());
    }
    for (let f = 0; f < 2; f++) {
      const buf = new PixelBuffer(DOT, DOT);
      buf.blit(skyLightMap('rising', f), SKY_LIGHT_PALETTE, 0, 0);
      this.dot.push(buf.toTexture());
    }
  }

  bigFor(frame: number, fill: number): Texture {
    const lit = Math.round(Math.max(0, Math.min(1, fill)) * PAPER_ROWS);
    return this.big[frame % FRAMES]?.[lit] ?? Texture.EMPTY;
  }

  destroy(): void {
    for (const row of this.big) for (const t of row) t.destroy(true);
    for (const t of this.small) t.destroy(true);
    for (const t of this.dot) t.destroy(true);
  }
}
