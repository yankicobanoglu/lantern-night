import { BufferImageSource, Texture } from 'pixi.js';
import { hexToRgb } from '../palette';

/** A pixel map is rows of characters; each character maps to a colour, '.' is transparent. */
export type PixelMap = readonly string[];
export type MapPalette = Readonly<Record<string, number>>;

/**
 * CPU-side RGBA buffer for the pixel world. All alpha is 0 or 255 to avoid
 * premultiplication surprises on upload. Upload with toTexture()/upload().
 */
export class PixelBuffer {
  readonly width: number;
  readonly height: number;
  readonly data: Uint8Array;
  private source: BufferImageSource | null = null;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.data = new Uint8Array(width * height * 4);
  }

  clear(hex?: number): void {
    if (hex === undefined) {
      this.data.fill(0);
      return;
    }
    const [r, g, b] = hexToRgb(hex);
    const d = this.data;
    for (let i = 0; i < d.length; i += 4) {
      d[i] = r;
      d[i + 1] = g;
      d[i + 2] = b;
      d[i + 3] = 255;
    }
  }

  set(x: number, y: number, hex: number): void {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return;
    const i = (y * this.width + x) * 4;
    const d = this.data;
    d[i] = (hex >> 16) & 0xff;
    d[i + 1] = (hex >> 8) & 0xff;
    d[i + 2] = hex & 0xff;
    d[i + 3] = 255;
  }

  erase(x: number, y: number): void {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return;
    const i = (y * this.width + x) * 4;
    this.data[i + 3] = 0;
  }

  /** Returns the colour as a hex number, or -1 if transparent or out of range. */
  get(x: number, y: number): number {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return -1;
    const i = (y * this.width + x) * 4;
    const d = this.data;
    if ((d[i + 3] ?? 0) === 0) return -1;
    return ((d[i] ?? 0) << 16) | ((d[i + 1] ?? 0) << 8) | (d[i + 2] ?? 0);
  }

  fillRect(x0: number, y0: number, w: number, h: number, hex: number): void {
    const x1 = Math.min(this.width, x0 + w);
    const y1 = Math.min(this.height, y0 + h);
    for (let y = Math.max(0, y0); y < y1; y++) {
      for (let x = Math.max(0, x0); x < x1; x++) this.set(x, y, hex);
    }
  }

  hline(x0: number, x1: number, y: number, hex: number): void {
    for (let x = Math.max(0, x0); x < Math.min(this.width, x1); x++) this.set(x, y, hex);
  }

  vline(x: number, y0: number, y1: number, hex: number): void {
    for (let y = Math.max(0, y0); y < Math.min(this.height, y1); y++) this.set(x, y, hex);
  }

  /**
   * Fill rows [y0, y1) with a checker of colours a and b using square cells of
   * `cell` art px. Used for 2-px dithering at sky band edges.
   */
  checker(x0: number, x1: number, y0: number, y1: number, a: number, b: number, cell = 2, phase = 0): void {
    for (let y = Math.max(0, y0); y < Math.min(this.height, y1); y++) {
      const cy = Math.floor((y - y0) / cell);
      for (let x = Math.max(0, x0); x < Math.min(this.width, x1); x++) {
        const cx = Math.floor((x - x0) / cell);
        this.set(x, y, (cx + cy + phase) % 2 === 0 ? a : b);
      }
    }
  }

  /** Draw a pixel map with its top-left at (x, y). */
  blit(map: PixelMap, palette: MapPalette, x: number, y: number, flipX = false): void {
    for (let row = 0; row < map.length; row++) {
      const line = map[row] ?? '';
      for (let col = 0; col < line.length; col++) {
        const ch = line[col] ?? '.';
        if (ch === '.' || ch === ' ') continue;
        const hex = palette[ch];
        if (hex === undefined) continue;
        const px = flipX ? x + (line.length - 1 - col) : x + col;
        this.set(px, y + row, hex);
      }
    }
  }

  /** Copy a rectangle from another buffer (alpha respected). */
  copyFrom(src: PixelBuffer, sx: number, sy: number, w: number, h: number, dx: number, dy: number): void {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const c = src.get(sx + x, sy + y);
        if (c >= 0) this.set(dx + x, dy + y, c);
      }
    }
  }

  /** Create (once) a nearest-neighbour texture backed by this buffer. */
  toTexture(): Texture {
    if (!this.source) {
      this.source = new BufferImageSource({
        resource: this.data,
        width: this.width,
        height: this.height,
        scaleMode: 'nearest',
        alphaMode: 'no-premultiply-alpha',
      });
    }
    return new Texture({ source: this.source });
  }

  /** Re-upload the buffer after mutating it. */
  upload(): void {
    this.source?.update();
  }

  destroy(): void {
    this.source?.destroy();
    this.source = null;
  }
}
