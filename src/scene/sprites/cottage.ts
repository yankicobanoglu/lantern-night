import type { PixelMap } from '../../engine/pixelBuffer';
import { PALETTE } from '../../palette';

/** b: walls, r: roof, w: lit window. */
export const COTTAGE_PALETTE = { b: PALETTE.nearHills, r: PALETTE.shore, w: PALETTE.lantern } as const;

export const COTTAGE_A: PixelMap = [
  '.....r..bb.',
  '....rrr.bb.',
  '...rrrrrrr.',
  '..rrrrrrrr.',
  '.rrrrrrrrrr',
  '.bbbwwwbbbb',
  '.bbbwwwbbbb',
  '.bbbbbbbbbb',
];

export const COTTAGE_B: PixelMap = [
  '..bb.........',
  '.rrrrrrrrrrr.',
  'rrrrrrrrrrrrr',
  '.bbbbbbbbbbb.',
  '.bbbbbbwwwbb.',
  '.bbbbbbwwwbb.',
  '.bbbbbbbbbbb.',
];

/** Window rectangle within each map, for the flicker overlay. */
export const COTTAGE_WINDOWS = {
  a: { x: 4, y: 5, w: 3, h: 2 },
  b: { x: 7, y: 4, w: 3, h: 2 },
} as const;
