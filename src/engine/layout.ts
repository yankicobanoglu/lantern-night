import { INTERNAL_HEIGHT, REGIONS } from '../config';

export type Layout = {
  /** CSS pixel size of the viewport. */
  cssWidth: number;
  cssHeight: number;
  dpr: number;
  /** Device pixels per art pixel (always an integer). */
  scale: number;
  /** CSS pixels per art pixel (may be fractional). */
  cssScale: number;
  /** Internal size of the pixel world in art pixels. */
  width: number;
  height: number;
  landscape: boolean;
  /** Row boundaries in art px. sky: [0, horizon), hills: [horizon, hillsEnd), lake: [hillsEnd, lakeEnd), shore: [lakeEnd, height). */
  horizon: number;
  hillsEnd: number;
  lakeEnd: number;
  /** Moon centre in art px. */
  moon: { x: number; y: number };
  /** Composition centre column in art px (the lantern's spot on the shore). */
  centreX: number;
  /** Where an unlit lantern waits, in art px (centre of the 26×34 sprite), held just above the shore. */
  lanternRest: { x: number; y: number };
};

/**
 * Pick an integer device-pixel scale so one art pixel is a uniform block, then
 * derive the internal size so the world fills the screen exactly.
 */
export function computeLayout(cssWidth: number, cssHeight: number, dpr: number): Layout {
  const deviceW = Math.round(cssWidth * dpr);
  const deviceH = Math.round(cssHeight * dpr);
  const scale = Math.max(1, Math.round(deviceH / INTERNAL_HEIGHT));
  const width = Math.ceil(deviceW / scale);
  const height = Math.ceil(deviceH / scale);
  const landscape = cssWidth > cssHeight;

  const horizon = Math.round(height * REGIONS.sky);
  const hillsEnd = Math.round(height * (REGIONS.sky + REGIONS.hills));
  const lakeEnd = Math.round(height * (REGIONS.sky + REGIONS.hills + REGIONS.lake));

  const moon = landscape
    ? { x: Math.round(width * 0.72), y: Math.round(height * 0.17) }
    : { x: Math.round(width * 0.74), y: Math.round(height * 0.16) };

  const centreX = Math.floor(width / 2);

  return {
    cssWidth,
    cssHeight,
    dpr,
    scale,
    cssScale: scale / dpr,
    width,
    height,
    landscape,
    horizon,
    hillsEnd,
    lakeEnd,
    moon,
    centreX,
    lanternRest: { x: centreX, y: lakeEnd - 26 },
  };
}
