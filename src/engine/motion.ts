/**
 * Motion level (SPEC section 6 Settings.motion). In M2 only the system value
 * is read; the Settings override arrives with storage in M3.
 */
export type MotionLevel = 'gentle' | 'full';

export function systemMotionLevel(): MotionLevel {
  if (typeof matchMedia !== 'function') return 'full';
  return matchMedia('(prefers-reduced-motion: reduce)').matches ? 'gentle' : 'full';
}
