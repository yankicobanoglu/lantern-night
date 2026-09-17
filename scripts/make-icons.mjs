// Draws the app icons from a hand-authored pixel map (SPEC section 7: all art in
// code). Writes PNGs with a tiny encoder over Node's zlib, no dependencies.
//   node scripts/make-icons.mjs
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const PALETTE = {
  '.': [0x1b, 0x1b, 0x3a], // night
  d: [0x23, 0x22, 0x50], // dusk
  h: [0x2e, 0x2a, 0x5c], // twilight halo
  v: [0x4a, 0x3b, 0x72], // violet halo
  s: [0xff, 0xf4, 0xd6], // star
  r: [0xe0, 0x8a, 0x3c], // ember rim
  p: [0xff, 0xc5, 0x6b], // lantern paper
  c: [0xff, 0xe7, 0xb3], // core
  w: [0x6b, 0x52, 0x38], // wood ring
  f: [0xff, 0x6a, 0x2b], // flame
};

// 16×16: a lit lantern with a soft halo, two stars, night above, dusk below.
const MAP = [
  '................',
  '..s.............',
  '.......hhhh...s.',
  '.....hhvvvvhh...',
  '....hvvrrrrvvh..',
  '....hvrppppprvh.',
  '...hvrppcccpprvh',
  '...hvrpcccccprvh',
  '...hvrpcccccprvh',
  '...hvrppcccpprvh',
  '....hvrppppprvh.',
  '....hvvrwwrvvh..',
  '.....hhvffvhh...',
  'dd....hhffhh..dd',
  'dddd....dd....dd',
  'dddddddddddddddd',
];

const CRC_TABLE = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function encodePng(width, height, rgba) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0; // filter: none
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/** Render the map at `size` px: nearest-neighbour at the largest integer scale that leaves `pad` fraction of border. */
function render(size, pad = 0) {
  const inner = Math.floor(size * (1 - pad * 2));
  const scale = Math.max(1, Math.floor(inner / 16));
  const off = Math.floor((size - 16 * scale) / 2);
  const rgba = Buffer.alloc(size * size * 4);
  const bg = PALETTE['.'];
  for (let i = 0; i < size * size; i++) {
    rgba[i * 4] = bg[0];
    rgba[i * 4 + 1] = bg[1];
    rgba[i * 4 + 2] = bg[2];
    rgba[i * 4 + 3] = 255;
  }
  // Dusk floor continues to the bottom edge under the padded map.
  const dusk = PALETTE.d;
  for (let y = off + 16 * scale; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      rgba[i] = dusk[0];
      rgba[i + 1] = dusk[1];
      rgba[i + 2] = dusk[2];
    }
  }
  for (let my = 0; my < 16; my++) {
    for (let mx = 0; mx < 16; mx++) {
      const col = PALETTE[MAP[my][mx]] ?? bg;
      for (let y = 0; y < scale; y++) {
        for (let x = 0; x < scale; x++) {
          const px = off + mx * scale + x;
          const py = off + my * scale + y;
          const i = (py * size + px) * 4;
          rgba[i] = col[0];
          rgba[i + 1] = col[1];
          rgba[i + 2] = col[2];
          rgba[i + 3] = 255;
        }
      }
    }
  }
  return encodePng(size, size, rgba);
}

const out = join(process.cwd(), 'public', 'icons');
mkdirSync(out, { recursive: true });
writeFileSync(join(out, 'icon-192.png'), render(192));
writeFileSync(join(out, 'icon-512.png'), render(512));
writeFileSync(join(out, 'icon-512-maskable.png'), render(512, 0.1));
writeFileSync(join(out, 'apple-touch-icon.png'), render(180));
console.log('icons written to', out);
