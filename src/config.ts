/**
 * Single place for deploy and layout constants.
 * Change BASE to '/' when the site moves to a custom domain.
 */
export const BASE = '/lantern-night/';

/** Target internal height of the pixel world in art pixels (portrait). */
export const INTERNAL_HEIGHT = 320;

/** Vertical composition, as fractions of the internal height (SPEC section 7). */
export const REGIONS = {
  sky: 0.55,
  hills: 0.15,
  lake: 0.2,
  shore: 0.1,
} as const;

/** Frequency of the slow tick that animates the pixel layer (window flicker, ripples, twinkle). */
export const SLOW_TICK_HZ = 10;
