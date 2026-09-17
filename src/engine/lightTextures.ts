import { Texture } from 'pixi.js';
import { hexToRgb } from '../palette';

const cache = new Map<string, Texture>();

function canvas2d(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2d context unavailable');
  return [canvas, ctx];
}

/**
 * Soft radial glow for the light layer: full resolution, additive.
 * `size` is the texture size in device px; alpha falls off with a smooth curve.
 */
export function radialGlowTexture(size: number, hex: number, innerAlpha = 1): Texture {
  const key = `r:${size}:${hex}:${innerAlpha}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const [canvas, ctx] = canvas2d(size, size);
  const [r, g, b] = hexToRgb(hex);
  const half = size / 2;
  const grad = ctx.createRadialGradient(half, half, 0, half, half, half);
  grad.addColorStop(0, `rgba(${r},${g},${b},${innerAlpha})`);
  grad.addColorStop(0.25, `rgba(${r},${g},${b},${innerAlpha * 0.45})`);
  grad.addColorStop(0.55, `rgba(${r},${g},${b},${innerAlpha * 0.12})`);
  grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const tex = Texture.from(canvas);
  cache.set(key, tex);
  return tex;
}

/**
 * Vertical reflection streak: a soft ellipse, brightest near the top (the
 * waterline under the light) and fading downward. Anchor it at (0.5, 0.12).
 */
export function streakTexture(width: number, height: number, hex: number, innerAlpha = 1): Texture {
  const key = `s:${width}:${height}:${hex}:${innerAlpha}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const [canvas, ctx] = canvas2d(width, height);
  const [r, g, b] = hexToRgb(hex);
  const cx = width / 2;
  const cy = height * 0.12;
  // Horizontal falloff via a radial gradient stretched vertically.
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(1, height / width);
  const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, cx);
  grad.addColorStop(0, `rgba(${r},${g},${b},${innerAlpha})`);
  grad.addColorStop(0.3, `rgba(${r},${g},${b},${innerAlpha * 0.4})`);
  grad.addColorStop(0.7, `rgba(${r},${g},${b},${innerAlpha * 0.08})`);
  grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
  ctx.fillStyle = grad;
  ctx.fillRect(-cx, -cy * (width / height), width, height * (width / height) * 2);
  ctx.restore();
  // Fade the top edge so the streak starts at the waterline, not above it.
  const fade = ctx.createLinearGradient(0, 0, 0, cy * 1.6);
  fade.addColorStop(0, 'rgba(0,0,0,1)');
  fade.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fillStyle = fade;
  ctx.fillRect(0, 0, width, cy * 1.6);
  ctx.globalCompositeOperation = 'source-over';
  const tex = Texture.from(canvas);
  cache.set(key, tex);
  return tex;
}
