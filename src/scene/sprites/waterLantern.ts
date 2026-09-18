import type { MapPalette, PixelMap } from '../../engine/pixelBuffer';
import { PALETTE } from '../../palette';
import { LIT_PALETTE, UNLIT_PALETTE } from './lantern';

/**
 * Water lantern (ROADMAP 4.1, the water scene): a tōrō-nagashi style floating
 * lantern, a paper box in a wooden frame on a flat float, the flame above the
 * open top once lit. 20×15 art px at rest, 14×10 and 7×5 as it drifts off; the
 * 4×4 sky-light dot is shared. Paper lights from the bottom while holding.
 *
 * Characters: p paper, c paper highlight, w frame wood, d float (dark wood),
 * f flame, y flame core, '.' transparent.
 */
export const WATER_LARGE_W = 20;
export const WATER_LARGE_H = 15;
export const WATER_BIG_W = 14;
export const WATER_BIG_H = 10;
export const WATER_SMALL_W = 7;
export const WATER_SMALL_H = 5;
export const WATER_FRAMES = 4;

export const WATER_LIT_PALETTE: MapPalette = { ...LIT_PALETTE, d: PALETTE.woodDark };
export const WATER_UNLIT_PALETTE: MapPalette = { ...UNLIT_PALETTE, d: PALETTE.woodDark };

type Size = 'large' | 'big';

/** Paper rows: first row and count, per size. The flame takes rows 0–1. */
export const WATER_PAPER: Record<Size, { top: number; rows: number }> = {
  large: { top: 3, rows: 8 },
  big: { top: 3, rows: 5 },
};

const LARGE_BODY: PixelMap = [
  '....................',
  '....................',
  '..wwwwwwwwwwwwwwww..',
  '..wppppppppppppppw..',
  '..wppppppppppppppw..',
  '..wppppppppppppppw..',
  '..wppppppppppppppw..',
  '..wppppppppppppppw..',
  '..wppppppppppppppw..',
  '..wppppppppppppppw..',
  '..wppppppppppppppw..',
  '..wwwwwwwwwwwwwwww..',
  '.wwwwwwwwwwwwwwwwww.',
  'dddddddddddddddddddd',
  '.dddddddddddddddddd.',
];

const BIG_BODY: PixelMap = [
  '..............',
  '..............',
  '.wwwwwwwwwwww.',
  '.wppppppppppw.',
  '.wppppppppppw.',
  '.wppppppppppw.',
  '.wppppppppppw.',
  '.wppppppppppw.',
  '.wwwwwwwwwwww.',
  'dddddddddddddd',
];

/** Flame rows (0, 1) per frame when fully lit. */
const LARGE_FLAME_FULL: readonly (readonly [string, string])[] = [
  ['.........ff.........', '........fyyf........'],
  ['........fff.........', '........fyyf........'],
  ['.........ff.........', '.......ffyyf........'],
  ['..........ff........', '........fyyff.......'],
];
const LARGE_FLAME_SMALL: readonly [string, string] = ['....................', '.........yy.........'];
const BIG_FLAME_FULL: readonly (readonly [string, string])[] = [
  ['......ff......', '.....fyyf.....'],
  ['.....ff.......', '.....fyyf.....'],
  ['......ff......', '....ffyyf.....'],
  ['.......f......', '.....fyyff....'],
];
const BIG_FLAME_SMALL: readonly [string, string] = ['..............', '......yy......'];
const NONE = (w: number): readonly [string, string] => ['.'.repeat(w), '.'.repeat(w)];

/** Inner glow per frame: an ellipse of highlight in the paper that breathes a little (paper-local coordinates). */
const GLOW: readonly { cx: number; cy: number; rx: number; ry: number }[] = [
  { cx: 7, cy: 4.2, rx: 4.2, ry: 2.6 },
  { cx: 7, cy: 3.8, rx: 3.6, ry: 2.9 },
  { cx: 6.5, cy: 4.4, rx: 4.6, ry: 2.3 },
  { cx: 7.5, cy: 4.1, rx: 3.4, ry: 2.4 },
];

function setChar(row: string, x: number, ch: string): string {
  return row.slice(0, x) + ch + row.slice(x + 1);
}

/** Pixel map for a water lantern with `litRows` of paper lit from the bottom and flicker `frame`. */
export function waterLanternMap(frame: number, litRows: number, size: Size = 'large'): PixelMap {
  const f = ((frame % WATER_FRAMES) + WATER_FRAMES) % WATER_FRAMES;
  const body = size === 'large' ? LARGE_BODY : BIG_BODY;
  const paper = WATER_PAPER[size];
  const rows = body.map((r) => r);
  const g = GLOW[f] ?? GLOW[0]!;
  const scale = size === 'large' ? 1 : 0.7;
  for (let y = 0; y < paper.rows; y++) {
    const row = rows[paper.top + y] ?? '';
    let out = row;
    const px0 = row.indexOf('p');
    for (let x = 0; x < row.length; x++) {
      if (row[x] !== 'p') continue;
      const dx = (x - px0 + 0.5 - g.cx * scale) / (g.rx * scale);
      const dy = (y + 0.5 - g.cy * scale) / (g.ry * scale);
      if (dx * dx + dy * dy <= 1) out = setChar(out, x, 'c');
    }
    rows[paper.top + y] = out;
  }
  const full = size === 'large' ? LARGE_FLAME_FULL : BIG_FLAME_FULL;
  const small = size === 'large' ? LARGE_FLAME_SMALL : BIG_FLAME_SMALL;
  const flame = litRows <= 0 ? NONE(body[0]!.length) : litRows < paper.rows / 2 ? small : (full[f] ?? full[0]!);
  rows[0] = flame[0];
  rows[1] = flame[1];
  return rows;
}

/**
 * Split of the map into unlit (paper still dark, drawn in plum) and lit
 * (everything else: lit paper, frame, float, flame) parts for a fill level.
 */
export function waterLanternMaps(frame: number, fill: number, size: Size = 'large'): { unlit: PixelMap; lit: PixelMap; litRows: number } {
  const paper = WATER_PAPER[size];
  const clamped = Math.max(0, Math.min(1, fill));
  const litRows = Math.round(clamped * paper.rows);
  const map = waterLanternMap(frame, litRows, size);
  const split = paper.top + paper.rows - litRows; // first lit paper row
  const blank = '.'.repeat(map[0]!.length);
  const isDarkPaper = (y: number): boolean => y >= paper.top && y < split;
  return {
    unlit: map.map((row, y) => (isDarkPaper(y) ? row : blank)),
    lit: map.map((row, y) => (isDarkPaper(y) ? blank : row)),
    litRows,
  };
}

/** Small drifting lantern, 7×5, two frames. */
export function smallWaterLanternMap(frame: number): PixelMap {
  const f = frame % 2 === 0 ? 0 : 1;
  return [f === 0 ? '...y...' : '..y....', '.wwwww.', f === 0 ? '.wpcpw.' : '.wcccw.', '.wpppw.', 'ddddddd'];
}
