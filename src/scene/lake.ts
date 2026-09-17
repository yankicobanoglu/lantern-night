import { Container, Rectangle, Sprite, Texture, type RenderTexture } from 'pixi.js';
import type { Layout } from '../engine/layout';
import { PixelBuffer } from '../engine/pixelBuffer';
import { hash01 } from '../engine/rng';
import { PALETTE } from '../palette';

/**
 * The lake is a flipped, vertically squashed copy of everything above the
 * shoreline (SPEC section 8), built from one-art-px-high row sprites that sample
 * the `above` render texture. Each row gets an integer x offset from a slow sine
 * (snapped to the grid) and is darkened about 40%.
 */
export class Lake {
  readonly container = new Container();
  private base: Sprite;
  private rows: Sprite[] = [];
  private ripple: PixelBuffer;
  private rippleSprite: Sprite;
  private lakeH = 0;
  private rowTextures: Texture[] = [];

  constructor(private layout: Layout, aboveRT: RenderTexture) {
    this.base = new Sprite(Texture.WHITE);
    this.base.tint = PALETTE.lake;
    this.ripple = new PixelBuffer(1, 1);
    this.rippleSprite = new Sprite(Texture.EMPTY);
    this.container.addChild(this.base);
    this.build(layout, aboveRT);
  }

  build(layout: Layout, aboveRT: RenderTexture): void {
    this.layout = layout;
    const { width, hillsEnd, lakeEnd } = layout;
    this.lakeH = lakeEnd - hillsEnd;

    for (const r of this.rows) r.destroy();
    for (const t of this.rowTextures) t.destroy();
    this.rows = [];
    this.rowTextures = [];
    this.rippleSprite.destroy();
    this.ripple.destroy();

    this.base.position.set(0, hillsEnd);
    this.base.width = width;
    this.base.height = this.lakeH;

    const squash = hillsEnd / this.lakeH;
    for (let r = 0; r < this.lakeH; r++) {
      const srcY = Math.max(0, hillsEnd - 1 - Math.floor(r * squash));
      const tex = new Texture({ source: aboveRT.source, frame: new Rectangle(0, srcY, width, 1) });
      const sprite = new Sprite(tex);
      sprite.position.set(0, hillsEnd + r);
      sprite.tint = 0x999999; // about 40% darker
      sprite.alpha = 0.82; // let the lake colour show through
      this.rows.push(sprite);
      this.rowTextures.push(tex);
      this.container.addChild(sprite);
    }

    this.ripple = new PixelBuffer(width, this.lakeH);
    this.rippleSprite = new Sprite(this.ripple.toTexture());
    this.rippleSprite.position.set(0, hillsEnd);
    this.container.addChild(this.rippleSprite);
    this.slowTick(0);
  }

  /** Per-frame: gentle horizontal sway, snapped to whole art px. */
  update(timeMs: number): void {
    const t = timeMs / 1000;
    for (let r = 0; r < this.rows.length; r++) {
      const depth = r / this.lakeH; // 0 far shore, 1 near
      const amp = 0.6 + depth * 1.6;
      const x = Math.round(amp * Math.sin(t * 0.45 + r * 0.7) + 0.4 * Math.sin(t * 0.9 - r * 0.33));
      this.rows[r]!.x = x;
    }
  }

  /** Low-rate: sparse ripple highlights drifting across the water. */
  slowTick(tick: number): void {
    const { width } = this.layout;
    this.ripple.clear();
    const count = Math.round((width * this.lakeH) / 70);
    for (let i = 0; i < count; i++) {
      const depth = hash01(i, 3);
      const y = Math.floor(depth * this.lakeH);
      const len = 2 + Math.floor(hash01(i, 5) * 3);
      const speed = 0.15 + depth * 0.3;
      const x = Math.floor((hash01(i, 7) * width + tick * speed) % width);
      // Blink: only some ripples are visible at a time.
      if (hash01(i + tick * 0, 9) + Math.sin(tick * 0.2 + i) * 0.5 < 0.35) continue;
      this.ripple.hline(x, x + len, y, PALETTE.ripple);
    }
    this.ripple.upload();
  }
}
