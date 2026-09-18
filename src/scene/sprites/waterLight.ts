import type { MapPalette, PixelMap } from '../../engine/pixelBuffer';
import { PALETTE } from '../../palette';
import type { SkyStatus } from './lantern';

/**
 * A water lantern that has drifted out and settled (M7). It must not read as a
 * sky lantern's 4×4 dot: this one is wider than it is tall, sits low, and
 * carries a short dimmer reflection a pixel below it, which is what a light on
 * water looks like. Statuses follow the sky light's rules: larger and brighter
 * when it came true, ember and dim when it was let go.
 *
 * Characters: p paper, c core, r ember (the reflection, and a let-go light).
 */
export const WATER_LIGHT_W = 6;
export const WATER_LIGHT_H = 5;

export const WATER_LIGHT_PALETTE: MapPalette = { p: PALETTE.lantern, c: PALETTE.lanternCore, r: PALETTE.ember };

const RISING: readonly PixelMap[] = [
  [
    '.pppp.',
    'pccccp',
    '.pppp.',
    '......',
    '..rr..',
  ],
  [
    '.pppp.',
    'pcpccp',
    '.pppp.',
    '......',
    '.rrrr.',
  ],
];

const CAME_TRUE: readonly PixelMap[] = [
  [
    '.pppp.',
    'pccccp',
    'pccccp',
    '......',
    '.rrrr.',
  ],
  [
    '.cccc.',
    'cccccc',
    'cpcccc',
    '......',
    '..rr..',
  ],
];

const LET_GO: PixelMap = [
  '.rrrr.',
  'rrrrrr',
  '.rrrr.',
  '......',
  '......',
];

/** The settled water light for a status, with a slow twinkle between two frames. */
export function waterLightMap(status: SkyStatus, twinkle = 0): PixelMap {
  if (status === 'let-go') return LET_GO;
  const set = status === 'came-true' ? CAME_TRUE : RISING;
  return set[twinkle % 2 === 0 ? 0 : 1]!;
}
