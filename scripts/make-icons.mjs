// Draws the app icons from a hand-authored pixel map (SPEC section 7: all art in
// code, palette exact). Writes PNGs with a tiny encoder over Node's zlib, no
// dependencies.
//   node scripts/make-icons.mjs
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const HEX = {
  night: 0x1b1b3a,
  dusk: 0x232250,
  twilight: 0x2e2a5c,
  violet: 0x4a3b72,
  plum: 0x6b4e8c,
  rose: 0xa86a8c,
  blush: 0xd98a84,
  apricot: 0xe8a07a,
  farHills: 0x3a3f6e,
  nearHills: 0x262a4f,
  shore: 0x171a33,
  lake: 0x1f2e4f,
  ripple: 0x2b3d63,
  moon: 0xf3ebd3,
  star: 0xfff4d6,
  lantern: 0xffc56b,
  lanternCore: 0xffe7b3,
  ember: 0xe08a3c,
  flame: 0xff6a2b,
  wood: 0x6b5238,
  earthshine: 0x474776,
};
const rgb = (hex) => [(hex >> 16) & 0xff, (hex >> 8) & 0xff, hex & 0xff];

/** Sky ladder, top to bottom; the halo climbs it toward the horizon glow. */
const BANDS = ['night', 'dusk', 'twilight', 'violet', 'plum', 'rose', 'blush'];

const CHAR = {
  '.': 'sky', // filled from the band row below
  s: 'star',
  M: 'moon',
  e: 'earthshine',
  H: 'farHills',
  N: 'nearHills',
  L: 'lake',
  '~': 'ripple',
  p: 'lantern',
  c: 'lanternCore',
  r: 'ember',
  w: 'wood',
  f: 'flame',
  y: 'lanternCore',
};

// 32×32. Sky rows use '.', and take their colour from BAND_ROWS. A lit paper
// lantern floats above a lake at dusk; the moon is a waxing gibbous, top right.
const MAP = [
  '................................',
  '..s.............................',
  '.......................eeMM.....',
  '..............s.......eeMMMM....',
  '.....................eeMMMMM....',
  '.s...................eeMMMMM....',
  '......................eeMMMM..s.',
  '.......................eeMM.....',
  '............rrrrrr..............',
  '..........rrppppppprr...........',
  '..s.......rpppppppppr...........',
  '.........rppppcccppppr..........',
  '.........rpppcccccpppr..........',
  '.........rpppcccccpppr.......s..',
  '.........rpppcccccpppr..........',
  '.........rppppcccppppr..........',
  '..........rpppppppppr...........',
  '..........rrppppppprr...........',
  '............rrwwrr..............',
  '.............yffy...............',
  '..............ff................',
  '................................',
  '................................',
  '.....HH.................HHH.....',
  'HHHHHHHHH.....HH......HHHHHHHHHH',
  'HHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHH',
  'NNNHHHHHHHHHHHHHHHHHHHHHHHHHHNNN',
  'NNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNN',
  'LLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLL',
  'LL~~LLLLL~~~LLLLLLLLL~~LLLLL~~LL',
  'LLLLLLL~~LLLLLL~~~LLLLLLL~~LLLLL',
  'LLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLL',
];

/** Which sky band each row belongs to (index into BANDS), with 2-px dithered edges. */
function bandAt(x, y) {
  // Band boundaries by row: night 0–6, dusk 7–11, twilight 12–15, violet 16–19, plum 20–22, rose 23–25, blush 26–27.
  const edges = [7, 12, 16, 20, 23, 26];
  let band = 0;
  for (const e of edges) if (y >= e) band++;
  // Two-pixel checker on the two rows above each edge, mixing with the band below.
  for (const e of edges) {
    if (y === e - 1 || y === e - 2) {
      const cx = Math.floor(x / 2);
      const cy = Math.floor((y - (e - 2)) / 2);
      if ((cx + cy) % 2 === 1) return Math.min(BANDS.length - 1, band + 1);
    }
  }
  return band;
}

/** Distance from a sky pixel to the lantern body (rows 8–20, cols 9–21), in art px. */
function lanternDistance(x, y) {
  const dx = Math.max(9 - x, 0, x - 21);
  const dy = Math.max(8 - y, 0, y - 20);
  return Math.hypot(dx, dy);
}

function colourAt(x, y) {
  const ch = MAP[y][x];
  const name = CHAR[ch];
  if (name !== 'sky') return HEX[name];
  let band = bandAt(x, y);
  // Warm halo: the sky steps up the ladder near the lantern, two steps close in.
  const d = lanternDistance(x, y);
  if (d <= 2.5) band += 2;
  else if (d <= 5) band += 1;
  return HEX[BANDS[Math.min(BANDS.length - 1, band)]];
}

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
    raw[y * (width * 4 + 1)] = 0;
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const N = MAP.length;

/**
 * Render at `size` px: nearest-neighbour at the largest integer scale that fits
 * inside (1 − 2·pad) of the icon, centred; the border continues the edge rows
 * and columns of the map, so no frame ever shows.
 */
function render(size, pad = 0) {
  const inner = Math.floor(size * (1 - pad * 2));
  const scale = Math.max(1, Math.floor(inner / N));
  const off = Math.floor((size - N * scale) / 2);
  const rgba = Buffer.alloc(size * size * 4);
  for (let py = 0; py < size; py++) {
    const my = Math.min(N - 1, Math.max(0, Math.floor((py - off) / scale)));
    for (let px = 0; px < size; px++) {
      const mx = Math.min(N - 1, Math.max(0, Math.floor((px - off) / scale)));
      const [r, g, b] = rgb(colourAt(mx, my));
      const i = (py * size + px) * 4;
      rgba[i] = r;
      rgba[i + 1] = g;
      rgba[i + 2] = b;
      rgba[i + 3] = 255;
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
