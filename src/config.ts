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

/** Session light arc (SPEC section 3, P1): the horizon eases from apricot to plum over this long, from page open. */
export const LIGHT_ARC_S = 180;

/** Fireflies along the shore; halved under reduced motion. */
export const FIREFLY_COUNT = 14;

/**
 * Watch state: the Light another / Goodnight buttons fade in once the released
 * lantern has passed this fraction of the sky band, or reached this rise
 * progress (review note after M2b; SPEC section 3 says ~6 s, kept as a fallback ceiling).
 */
export const WATCH_BUTTONS_SKY_FRACTION = NEXT_LANTERN_SKY_FRACTION;
export const WATCH_BUTTONS_MIN_PROGRESS = NEXT_LANTERN_MIN_PROGRESS;
/** The written text follows the rising lantern and fades over this long. */
export const WISH_FADE_MS = 3000;

/** Shooting stars (SPEC section 7, Legibility). */
export const STAR_INTERVAL_MIN_S = 45;
export const STAR_INTERVAL_MAX_S = 120;
export const STAR_FIRST_SESSION_MAX_S = 60;
export const STAR_TWINKLE_S = 0.3;
export const STAR_CROSS_S = 1.4;
export const STAR_FADE_S = 0.6;
export const STAR_LINGER_S = 0.6;
export const STAR_HEAD_PX = 9;
export const STAR_TRAIL_PX = 80;
export const STAR_HIT_PX = 64;
export const STAR_CROSS_FRACTION = 0.4;
