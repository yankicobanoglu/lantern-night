/** SPEC section 7 palette. Exact hex values; do not tune. */
export const PALETTE = {
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
  glow: 0xffb547,
  firefly: 0xd8f28a,
  wood: 0x6b5238,
  woodDark: 0x4a3a2a,
  earthshine: 0x474776,
} as const;

export type PaletteKey = keyof typeof PALETTE;

/** Sky bands from the top of the sky down to the horizon. */
export const SKY_BANDS: readonly PaletteKey[] = [
  'night',
  'dusk',
  'twilight',
  'violet',
  'plum',
  'rose',
  'blush',
  'apricot',
];

export function hexToRgb(hex: number): [number, number, number] {
  return [(hex >> 16) & 0xff, (hex >> 8) & 0xff, hex & 0xff];
}
