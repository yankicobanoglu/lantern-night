import { Container, RenderTexture, type Renderer } from 'pixi.js';
import { computeLayout } from '../engine/layout';
import type { MoonFrame } from '../ritual/moonPhase';
import { COPY } from '../ritual/copy';
import type { LanternKind } from '../scene/field';
import { Scene } from '../scene/scene';
import type { SkyLight } from '../scene/skyLights';

/** SPEC section 9: a 1080×1920 PNG. 320 art px tall at 6× is exactly 1920. */
export const SHARE_W = 1080;
export const SHARE_H = 1920;

export type ShareInput = {
  renderer: Renderer;
  seed: number;
  moonFrame: MoonFrame;
  /** Every light in tonight's sky (stored and session-only). */
  skyLights: readonly SkyLight[];
  /** Each lantern still on its way: how far along it is (0–1), and which kind it is. */
  rising: readonly { p: number; kind: LanternKind }[];
  /** The wish to include, or null. */
  wish: string | null;
  /** Session light arc position, so the image matches the screen. */
  evening: number;
  /** Tonight's moon size (ROADMAP 4.6). */
  supermoon: boolean;
};

/** Wait for the two fonts the image uses; drawing goes ahead with fallbacks if they never come. */
async function ensureFonts(): Promise<void> {
  if (typeof document === 'undefined' || !('fonts' in document)) return;
  try {
    await Promise.race([
      Promise.all([document.fonts.load('400 60px "Pixelify Sans"'), document.fonts.load('600 44px "Nunito"')]),
      new Promise((r) => setTimeout(r, 1500)),
    ]);
  } catch {
    /* fallbacks */
  }
}

/** Greedy word wrap for the wish panel. */
export function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const probe = line ? `${line} ${w}` : w;
    if (line && ctx.measureText(probe).width > maxWidth) {
      lines.push(line);
      line = w;
    } else {
      line = probe;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/**
 * Re-render the scene for a portrait 180×320 art px world at 6×, then add the
 * wordmark and, when asked, the wish in a section 7 panel. Returns the 2D canvas.
 */
export async function composeShareCanvas(input: ShareInput): Promise<HTMLCanvasElement> {
  const layout = computeLayout(SHARE_W, SHARE_H, 1);
  const stage = new Container();
  const scene = new Scene(input.renderer, stage, layout, input.seed, 'full');
  scene.setMoonFrame(input.moonFrame);
  scene.moon.setSupermoon(input.supermoon);
  scene.setEvening(input.evening);
  for (const l of input.skyLights) scene.addLight({ seed: l.seed, sky: l.sky, status: l.status, kind: l.kind });
  for (const r of input.rising) scene.lanternsOf(r.kind).spawnRising(Math.max(0.02, Math.min(0.98, r.p)));
  // A few frames so the halos, bob and flicker take their normal values.
  for (let i = 0; i < 3; i++) scene.update(16);

  const rt = RenderTexture.create({ width: SHARE_W, height: SHARE_H, resolution: 1, antialias: false });
  input.renderer.render({ container: stage, target: rt, clear: true });
  const world = input.renderer.extract.canvas({ target: rt }) as HTMLCanvasElement;

  const canvas = document.createElement('canvas');
  canvas.width = SHARE_W;
  canvas.height = SHARE_H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2d context unavailable');
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#1b1b3a';
  ctx.fillRect(0, 0, SHARE_W, SHARE_H);
  ctx.drawImage(world, 0, 0, SHARE_W, SHARE_H);

  await ensureFonts();

  // Wordmark at the bottom.
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.font = '400 60px "Pixelify Sans", "Nunito", sans-serif';
  ctx.shadowColor = 'rgba(27, 27, 58, 0.9)';
  ctx.shadowBlur = 24;
  ctx.shadowOffsetY = 4;
  ctx.fillStyle = '#fff4d6';
  ctx.fillText(COPY.title, SHARE_W / 2, SHARE_H - 84);
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  // The wish in a soft panel above the wordmark, over the shore.
  if (input.wish) {
    ctx.font = '600 44px "Nunito", system-ui, sans-serif';
    const pad = 44;
    const maxText = 880;
    const lines = wrapLines(ctx, input.wish, maxText - pad * 2);
    const lineH = 60;
    const textW = Math.max(...lines.map((l) => ctx.measureText(l).width), 200);
    const w = Math.min(maxText, textW + pad * 2);
    const h = lines.length * lineH + pad * 2 - 12;
    const x = (SHARE_W - w) / 2;
    const y = SHARE_H - 180 - h;
    ctx.fillStyle = 'rgba(27, 27, 58, 0.72)';
    roundRect(ctx, x, y, w, h, 36);
    ctx.fill();
    ctx.strokeStyle = 'rgba(232, 160, 122, 0.2)';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = '#fff4d6';
    ctx.textBaseline = 'middle';
    lines.forEach((l, i) => ctx.fillText(l, SHARE_W / 2, y + pad + lineH * i + lineH / 2 - 6));
  }

  rt.destroy(true);
  scene.destroy();
  stage.destroy({ children: true });
  return canvas;
}

export function shareFileName(now: Date): string {
  return `lantern-night-${now.toISOString().slice(0, 10)}.png`;
}

export function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/png');
  });
}
