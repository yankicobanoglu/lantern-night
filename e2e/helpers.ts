import type { Page, TestInfo } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export const OUT_DIR = join(process.cwd(), 'e2e', 'output');

export async function openScene(page: Page, query: string): Promise<void> {
  await page.goto(`?${query}`);
  await page.waitForSelector('body[data-ready="true"]', { timeout: 30_000 });
  // Let the slow tick and halo settle.
  await page.waitForTimeout(400);
}

/** Save a full-size screenshot and a 50% "squint" copy next to it, no extra deps. */
export async function saveScreenshots(page: Page, testInfo: TestInfo, name: string): Promise<void> {
  mkdirSync(OUT_DIR, { recursive: true });
  const base = `${testInfo.project.name}-${name}`;
  const png = await page.screenshot({ path: join(OUT_DIR, `${base}.png`) });
  const halfDataUrl = await page.evaluate(async (b64) => {
    const img = new Image();
    img.src = `data:image/png;base64,${b64}`;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = Math.round(img.width / 2);
    c.height = Math.round(img.height / 2);
    const ctx = c.getContext('2d');
    if (!ctx) return '';
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL('image/png');
  }, png.toString('base64'));
  if (halfDataUrl) {
    writeFileSync(join(OUT_DIR, `${base}.squint.png`), Buffer.from(halfDataUrl.split(',')[1] ?? '', 'base64'));
  }
}

export type LayoutInfo = {
  width: number;
  height: number;
  scale: number;
  cssScale: number;
  horizon: number;
  hillsEnd: number;
  lakeEnd: number;
  moon: { x: number; y: number };
  dockX: number;
  landscape: boolean;
};

export function getLayout(page: Page): Promise<LayoutInfo> {
  return page.evaluate(() => {
    const l = window.__lantern!.layout;
    return {
      width: l.width,
      height: l.height,
      scale: l.scale,
      cssScale: l.cssScale,
      horizon: l.horizon,
      hillsEnd: l.hillsEnd,
      lakeEnd: l.lakeEnd,
      moon: l.moon,
      dockX: l.dockX,
      landscape: l.landscape,
    };
  });
}

export function samplePixel(page: Page, x: number, y: number): Promise<number> {
  return page.evaluate(([px, py]) => window.__lantern!.samplePixel(px!, py!), [x, y]);
}

export function sampleRect(page: Page, x: number, y: number, w: number, h: number): Promise<number[]> {
  return page.evaluate(([a, b, c, d]) => window.__lantern!.sampleRect(a!, b!, c!, d!), [x, y, w, h]);
}
