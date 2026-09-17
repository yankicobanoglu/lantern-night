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
  '.bbwwbbbwwb',
  '.bbwwbbbwwb',
  '.bbbbbbbbbb',
];

export const COTTAGE_B: PixelMap = [
  '..bb.........',
  '.rrrrrrrrrrr.',
  'rrrrrrrrrrrrr',
  '.bbbbbbbbbbb.',
  '.bbwwbbbbwwb.',
  '.bbwwbbbbwwb.',
  '.bbbbbbbbbbb.',
];

export type Rect = { x: number; y: number; w: number; h: number };

/** Window rectangles within each map, for the flicker overlay and the warm glow. */
export const COTTAGE_WINDOWS: Record<'a' | 'b', readonly Rect[]> = {
  a: [
    { x: 3, y: 5, w: 2, h: 2 },
    { x: 8, y: 5, w: 2, h: 2 },
  ],
  b: [
    { x: 3, y: 4, w: 2, h: 2 },
    { x: 9, y: 4, w: 2, h: 2 },
  ],
};

/** Chimney top (the pixel above which smoke starts) within each map. */
export const COTTAGE_CHIMNEYS = { a: { x: 8, y: 0 }, b: { x: 2, y: 0 } } as const;
