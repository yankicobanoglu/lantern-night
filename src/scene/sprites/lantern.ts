import type { MapPalette, PixelMap } from '../../engine/pixelBuffer';
import { PALETTE } from '../../palette';

/**
 * Lantern sprites (SPEC section 7, sizes raised after the M2 review): lantern
 * 18×24 with 4-frame paper and flame flicker, small sky lantern 9×12, sky
 * light 4×4 (5×5 when it came true).
 *
 * Characters: p paper, c paper highlight (light from inside), r rim, w bamboo
 * ring, o dark opening, f flame, y flame core, '.' transparent.
 */
export const LANTERN_W = 18;
export const LANTERN_H = 24;
export const SMALL_W = 9;
export const SMALL_H = 12;
export const DOT = 4;
/** Paper rows are 0..PAPER_ROWS-1; the ring and flame sit below. */
export const PAPER_ROWS = 20;
export const FRAMES = 4;

export const LIT_PALETTE: MapPalette = {
  p: PALETTE.lantern,
  c: PALETTE.lanternCore,
  r: PALETTE.ember,
  w: PALETTE.wood,
  o: PALETTE.shore,
  f: PALETTE.flame,
  y: PALETTE.lanternCore,
};

export const UNLIT_PALETTE: MapPalette = {
  p: PALETTE.plum,
  c: PALETTE.plum,
  r: PALETTE.violet,
  w: PALETTE.wood,
  o: PALETTE.shore,
  f: PALETTE.flame,
  y: PALETTE.lanternCore,
};

/** A wish lantern: wide rounded top, paper tapering to a bamboo ring, the flame in the opening. */
const BODY: PixelMap = [
  '......rrrrrr......',
  '....rrpppppprr....',
  '...rppppppppppr...',
  '..rppppppppppppr..',
  '.rppppppppppppppr.',
  'rppppppppppppppppr',
  'rppppppppppppppppr',
  'rppppppppppppppppr',
  'rppppppppppppppppr',
  'rppppppppppppppppr',
  'rppppppppppppppppr',
  'rppppppppppppppppr',
  'rppppppppppppppppr',
  '.rppppppppppppppr.',
  '.rppppppppppppppr.',
  '.rppppppppppppppr.',
  '..rppppppppppppr..',
  '..rppppppppppppr..',
  '...rppppppppppr...',
  '...rppppppppppr...',
  '...wwwwwwwwwwww...',
  '....woooooooow....',
  '.....woooooow.....',
  '......wwwwww......',
];

/** Inner glow per frame: an ellipse of highlight low in the paper that breathes a little. */
const GLOW: readonly { cx: number; cy: number; rx: number; ry: number }[] = [
  { cx: 8.5, cy: 13, rx: 3.6, ry: 4.2 },
  { cx: 8.5, cy: 12, rx: 3.1, ry: 4.6 },
  { cx: 8.0, cy: 13.5, rx: 4.1, ry: 3.6 },
  { cx: 9.0, cy: 13, rx: 3.0, ry: 3.6 },
];

/** Flame rows (21, 22) per frame when fully lit. */
const FLAME_FULL: readonly (readonly [string, string])[] = [
  ['....wofffffoow....', '.....wfyyyyfw.....'],
  ['....woofffooow....', '.....wyffyyfw.....'],
  ['....woofffffow....', '.....wffyyffw.....'],
  ['....wooffffoow....', '.....wfyyyffw.....'],
];
/** A small flame while the lantern is still filling. */
const FLAME_SMALL: readonly [string, string] = ['....woooooooow....', '.....wooyyoow.....'];
const FLAME_NONE: readonly [string, string] = ['....woooooooow....', '.....woooooow.....'];

function setChar(row: string, x: number, ch: string): string {
  return row.slice(0, x) + ch + row.slice(x + 1);
}

/**
 * Pixel map for a lantern with `litRows` of paper lit from the bottom
 * (0 = unlit, PAPER_ROWS = fully lit) and flicker `frame`.
 */
export function lanternMap(frame: number, litRows = PAPER_ROWS): PixelMap {
  const f = ((frame % FRAMES) + FRAMES) % FRAMES;
  const rows = BODY.map((r) => r);
  const g = GLOW[f] ?? GLOW[0]!;
  for (let y = 0; y < PAPER_ROWS; y++) {
    const row = rows[y] ?? '';
    let out = row;
    for (let x = 0; x < row.length; x++) {
      const dx = (x + 0.5 - g.cx) / g.rx;
      const dy = (y + 0.5 - g.cy) / g.ry;
      if (row[x] === 'p' && dx * dx + dy * dy <= 1) out = setChar(out, x, 'c');
    }
    rows[y] = out;
  }
  const flame = litRows <= 0 ? FLAME_NONE : litRows < PAPER_ROWS / 2 ? FLAME_SMALL : (FLAME_FULL[f] ?? FLAME_FULL[0]!);
  rows[21] = flame[0];
  rows[22] = flame[1];
  return rows;
}

/** Split of the lantern map into unlit (top) and lit (bottom) parts for a fill level. */
export function lanternMaps(frame: number, fill: number): { unlit: PixelMap; lit: PixelMap; litRows: number } {
  const clamped = Math.max(0, Math.min(1, fill));
  const litRows = Math.round(clamped * PAPER_ROWS);
  const map = lanternMap(frame, litRows);
  const split = PAPER_ROWS - litRows; // first lit paper row
  const blank = '.'.repeat(LANTERN_W);
  // The ring and flame rows always draw with the lit palette so the flame is orange.
  const unlit = map.map((row, y) => (y < split ? row : blank));
  const lit = map.map((row, y) => (y >= split ? row : blank));
  return { unlit, lit, litRows };
}

/** Small sky lantern, 2 frames. */
export function smallLanternMap(frame: number): PixelMap {
  const f = frame % 2 === 0 ? 0 : 1;
  return [
    '...rrr...',
    '..rpppr..',
    '.rpppppr.',
    'rpppppppr',
    f === 0 ? 'rpppcpppr' : 'rppcccppr',
    f === 0 ? 'rppcccppr' : 'rpccccppr',
    f === 0 ? 'rpppcpppr' : 'rppcccppr',
    '.rpppppr.',
    '.rpppppr.',
    '..wwwww..',
    f === 0 ? '..wfffw..' : '..woffw..',
    f === 0 ? '...wyw...' : '...wfw...',
  ];
}

export type SkyStatus = 'rising' | 'came-true' | 'still-growing' | 'let-go';

/** Sky light for a past lantern: warm, round, 4×4 or more, never a cool 1-px star. */
export function skyLightMap(status: SkyStatus, twinkle = 0): PixelMap {
  if (status === 'came-true') {
    return twinkle % 2 === 0 ? ['.ppp.', 'pcccp', 'pcccp', 'pcccp', '.ppp.'] : ['.ccc.', 'cpccc', 'ccccc', 'cccpc', '.ccc.'];
  }
  if (status === 'let-go') return ['.rr.', 'rrrr', 'rrrr', '.rr.'];
  return twinkle % 2 === 0 ? ['.pp.', 'pccp', 'pccp', '.pp.'] : ['.pp.', 'pcpp', 'ppcp', '.pp.'];
}

export const SKY_LIGHT_PALETTE: MapPalette = { p: PALETTE.lantern, c: PALETTE.lanternCore, r: PALETTE.ember };

/** Colours a map uses, for tests. */
export function mapColours(map: PixelMap, palette: MapPalette): Set<number> {
  const out = new Set<number>();
  for (const row of map) for (const ch of row) if (ch !== '.') { const c = palette[ch]; if (c !== undefined) out.add(c); }
  return out;
}
