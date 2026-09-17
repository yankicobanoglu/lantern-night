import type { PixelMap } from '../../engine/pixelBuffer';
import { PALETTE } from '../../palette';

export const PINE_PALETTE = { p: PALETTE.shore } as const;

export const PINE_SMALL: PixelMap = ['.p.', '.p.', 'ppp', 'ppp', '.p.', '.p.'];

export const PINE_MEDIUM: PixelMap = [
  '..p..',
  '..p..',
  '.ppp.',
  '.ppp.',
  '.ppp.',
  'ppppp',
  'ppppp',
  '..p..',
  '..p..',
];

export const PINE_TALL: PixelMap = [
  '...p...',
  '...p...',
  '..ppp..',
  '..ppp..',
  '.ppppp.',
  '..ppp..',
  '.ppppp.',
  'ppppppp',
  '.ppppp.',
  'ppppppp',
  '...p...',
  '...p...',
];

export const PINES: readonly PixelMap[] = [PINE_SMALL, PINE_MEDIUM, PINE_TALL];
