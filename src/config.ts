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

/** Hold-to-light duration (SPEC section 3: press and hold for 4 s while a breath guide expands). */
export const HOLD_MS = 4000;
/** Tap alternative: the lantern fills on its own over this time. */
export const TAP_LIGHT_MS = 1200;
/** Early release: the fill eases back down at this rate (fill units per second). */
export const UNFILL_PER_S = 0.9;

/** Rise speed in art px per second at the start of the rise; it eases to about a third near the sky point. */
export const RISE_SPEED = 13;
/** Reduced motion: the rise takes this many times longer. */
export const REDUCED_MOTION_RISE_FACTOR = 1.6;
/** Up to 12 active lanterns at once (SPEC section 8). */
export const MAX_ACTIVE = 12;
/** Up to 1,000 sky lights (SPEC section 8). */
export const MAX_SKY = 1000;
/**
 * The next unlit lantern appears on the shore once the released one has passed
 * this fraction of the sky band (measured from the horizon up), or has shrunk to
 * its dot stage, whichever comes first (review note after M2b: 4.5 s was too quick).
 */
export const NEXT_LANTERN_SKY_FRACTION = 0.5;
export const NEXT_LANTERN_MIN_PROGRESS = 0.85;

/** Fireflies along the shore; halved under reduced motion. */
export const FIREFLY_COUNT = 14;
