import { Texture } from 'pixi.js';
import { hexToRgb } from '../palette';

const cache = new Map<string, Texture>();

/**
 * Soft radial glow for the light layer: full resolution, additive.
 * `size` is the texture size in device px; alpha falls off with a smooth curve.
 */
export function radialGlowTexture(size: number, hex: number, innerAlpha = 1): Texture {
  const key = `${size}:${hex}:${innerAlpha}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2d context unavailable');
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
