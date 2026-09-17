import type { MapPalette, PixelMap } from '../../engine/pixelBuffer';
import { PALETTE } from '../../palette';

/**
 * Lantern sprites (SPEC section 7): lantern 12×16 with 4-frame paper and flame
 * flicker, small sky lantern 6×8, sky light 2×2 (3×3 when it came true).
 *
 * Characters: p paper, c paper highlight (light from inside), r rim, w bamboo
 * ring, o dark opening, f flame, y flame core, '.' transparent.
 */
export const LANTERN_W = 12;
export const LANTERN_H = 16;
export const SMALL_W = 6;
export const SMALL_H = 8;
/** Paper rows are 0..PAPER_ROWS-1; the ring and flame sit below. */
export const PAPER_ROWS = 13;
export const FRAMES = 4;

export const LIT_PALETTE: MapPalette = {
  p: PALETTE.lantern,
  c: PALETTE.lanternCore,
  r: PALETTE.ember,
  w: PALETTE.woodDark,
  o: PALETTE.shore,
  f: PALETTE.flame,
  y: PALETTE.lanternCore,
};

export const UNLIT_PALETTE: MapPalette = {
  p: PALETTE.plum,
  c: PALETTE.plum,
  r: PALETTE.violet,
  w: PALETTE.woodDark,
  o: PALETTE.shore,
  f: PALETTE.flame,
  y: PALETTE.lanternCore,
};

/** Body without highlights; rows 13–15 are replaced by the flame frames. */
const BODY: PixelMap = [
  '.....rr.....',
  '...rppppr...',
  '..rppppppr..',
  '.rppppppppr.',
  'rppppppppppr',
  'rppppppppppr',
  'rppppppppppr',
  'rppppppppppr',
  'rppppppppppr',
  'rppppppppppr',
  '.rppppppppr.',
  '.rppppppppr.',
  '..rppppppr..',
  '..wwwwwwww..',
  '...woooow...',
  '....woow....',
];

/** Highlight pixels per flicker frame: the inner glow wanders a little. */
const HIGHLIGHTS: readonly (readonly [number, number][])[] = [
  [[5, 6], [6, 6], [4, 7], [5, 7], [6, 7], [7, 7], [4, 8], [5, 8], [6, 8], [7, 8], [5, 9], [6, 9]],
  [[5, 5], [6, 5], [4, 6], [5, 6], [6, 6], [7, 6], [4, 7], [5, 7], [6, 7], [7, 7], [5, 8], [6, 8]],
  [[4, 6], [5, 6], [3, 7], [4, 7], [5, 7], [6, 7], [3, 8], [4, 8], [5, 8], [6, 8], [4, 9], [5, 9]],
  [[5, 6], [6, 6], [5, 7], [6, 7], [7, 7], [5, 8], [6, 8], [7, 8], [6, 9]],
];

/** Flame rows (14, 15) per frame when fully lit. */
const FLAME_FULL: readonly (readonly [string, string])[] = [
  ['...wffffw...', '....wyyw....'],
  ['...wfyyfw...', '....wffw....'],
  ['...wofffw...', '....wyfw....'],
  ['...wfffow...', '....wfyw....'],
];
/** A small flame while the lantern is still filling. */
const FLAME_SMALL: readonly [string, string] = ['...woooow...', '....wyyw....'];
const FLAME_NONE: readonly [string, string] = ['...woooow...', '....woow....'];

function setChar(row: string, x: number, ch: string): string {
  return row.slice(0, x) + ch + row.slice(x + 1);
}

/**
 * Pixel map for a lantern with `litRows` of paper lit from the bottom
 * (0 = unlit, PAPER_ROWS = fully lit) and flicker `frame`.
 * The lit rows use the LIT palette and the rest the UNLIT palette, so the
 * caller draws twice with a row split; see lanternMaps().
 */
export function lanternMap(frame: number, litRows = PAPER_ROWS): PixelMap {
  const f = ((frame % FRAMES) + FRAMES) % FRAMES;
  const rows = BODY.map((r) => r);
  for (const [x, y] of HIGHLIGHTS[f] ?? []) {
    const row = rows[y];
    if (row && row[x] === 'p') rows[y] = setChar(row, x, 'c');
  }
  const flame = litRows <= 0 ? FLAME_NONE : litRows < 7 ? FLAME_SMALL : (FLAME_FULL[f] ?? FLAME_FULL[0]!);
  rows[14] = flame[0];
  rows[15] = flame[1];
  return rows;
}

/** Split of the lantern map into unlit (top) and lit (bottom) parts for a fill level. */
export function lanternMaps(frame: number, fill: number): { unlit: PixelMap; lit: PixelMap; litRows: number } {
  const clamped = Math.max(0, Math.min(1, fill));
  const litRows = Math.round(clamped * PAPER_ROWS);
  const map = lanternMap(frame, litRows);
  const split = PAPER_ROWS - litRows; // first lit paper row
  const blank = '.'.repeat(LANTERN_W);
  const unlit = map.map((row, y) => (y < split ? row : y < PAPER_ROWS ? blank : y >= 13 ? row : blank));
  const lit = map.map((row, y) => (y >= split && y < PAPER_ROWS ? row : blank));
  // The ring and flame rows (13–15) always draw with the lit palette so the flame is orange.
  return {
    unlit: unlit.map((row, y) => (y >= 13 ? blank : row)),
    lit: lit.map((row, y) => (y >= 13 ? (map[y] ?? blank) : row)),
    litRows,
  };
}

/** Small sky lantern, 2 frames. */
export function smallLanternMap(frame: number): PixelMap {
  const f = frame % 2 === 0 ? 0 : 1;
  return [
    '..rr..',
    '.pppp.',
    'rppppr',
    f === 0 ? 'rpccpr' : 'rcppcr',
    'rppppr',
    '.pppp.',
    '.wwww.',
    f === 0 ? '..ff..' : '..fy..',
  ];
}

export type SkyStatus = 'rising' | 'came-true' | 'still-growing' | 'let-go';

/** Sky light for a past lantern: warm, at least 2×2, never a cool 1-px star. */
export function skyLightMap(status: SkyStatus, twinkle = 0): PixelMap {
  if (status === 'came-true') return twinkle % 2 === 0 ? ['pcp', 'ccc', 'pcp'] : ['ccc', 'cpc', 'ccc'];
  if (status === 'let-go') return ['rr', 'rr'];
  return twinkle % 2 === 0 ? ['cp', 'pp'] : ['pp', 'pc'];
}

export const SKY_LIGHT_PALETTE: MapPalette = { p: PALETTE.lantern, c: PALETTE.lanternCore, r: PALETTE.ember };

/** Colours a map uses, for tests. */
export function mapColours(map: PixelMap, palette: MapPalette): Set<number> {
  const out = new Set<number>();
  for (const row of map) for (const ch of row) if (ch !== '.') { const c = palette[ch]; if (c !== undefined) out.add(c); }
  return out;
}
