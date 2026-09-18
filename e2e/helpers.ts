import type { Page, TestInfo } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export const OUT_DIR = join(process.cwd(), 'e2e', 'output');

/** Tests pin the quality level unless they ask for something else: headless GPUs are slow and the governor would otherwise step down mid-test. */
export function withQuality(query: string): string {
  return query.includes('quality=') ? query : `${query}&quality=3`;
}

export async function openScene(page: Page, query: string): Promise<void> {
  await page.goto(`?${withQuality(query)}`);
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
  centreX: number;
  landscape: boolean;
  lanternRest: { x: number; y: number };
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
      centreX: l.centreX,
      landscape: l.landscape,
      lanternRest: l.lanternRest,
    };
  });
}

export function samplePixel(page: Page, x: number, y: number): Promise<number> {
  return page.evaluate(([px, py]) => window.__lantern!.samplePixel(px!, py!), [x, y]);
}

export function sampleRect(page: Page, x: number, y: number, w: number, h: number): Promise<number[]> {
  return page.evaluate(([a, b, c, d]) => window.__lantern!.sampleRect(a!, b!, c!, d!), [x, y, w, h]);
}

/** Open the app and wait for the arrive screen. */
export async function openRitual(page: Page, query: string): Promise<void> {
  await page.goto(`?${withQuality(query)}`);
  await page.waitForSelector('body[data-ready="true"]', { timeout: 30_000 });
  await page.waitForSelector('#ui[data-state="arrive"]', { timeout: 10_000 });
  await page.waitForTimeout(300);
}

/** Begin → intention → fold, leaving an unlit lantern on the shore. */
export async function foldLantern(page: Page, text: string, mode: 'wish' | 'let-go' = 'wish', kind?: 'sky' | 'water'): Promise<void> {
  await page.getByRole('button', { name: 'Begin' }).click();
  await page.waitForSelector('#ui[data-state="intention"]');
  await page.getByRole('button', { name: mode === 'wish' ? 'Make a wish' : 'Let something go' }).click();
  await page.getByLabel('Your intention').fill(text);
  // The kind of lantern (M7): left alone it keeps whatever was chosen last.
  if (kind) await page.getByRole('button', { name: kind === 'water' ? 'Water lantern' : 'Sky lantern', exact: true }).click();
  await page.getByRole('button', { name: 'Fold my lantern' }).click();
  await page.waitForSelector('#ui[data-state="light"]');
  await page.waitForFunction(() => window.__lantern!.lanterns().some((l) => l.phase === 'unlit'));
  await page.waitForTimeout(200);
}

/** Read one key straight from IndexedDB (not through the app's store). */
export function readIdb(page: Page, key: string): Promise<unknown> {
  return page.evaluate(
    (k) =>
      new Promise((resolve) => {
        const req = indexedDB.open('lantern-night');
        req.onerror = () => resolve('error');
        req.onsuccess = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains('kv')) {
            resolve(undefined);
            return;
          }
          const g = db.transaction('kv').objectStore('kv').get(k);
          g.onsuccess = () => resolve(g.result ?? undefined);
          g.onerror = () => resolve('error');
        };
      }),
    key,
  );
}

export type StoredLantern = {
  id: string;
  text: string;
  createdAt: string;
  returnAt: string;
  status: 'rising' | 'came-true' | 'still-growing' | 'let-go';
  sky: { x: number; y: number };
  seed: number;
  /** Which kind of lantern it was (M7). A record seeded without one reads as 'sky'. */
  kind?: 'sky' | 'water';
};

export function lanternAt(daysAgo: number, now: Date, over: Partial<StoredLantern> = {}): StoredLantern {
  const DAY = 86_400_000;
  const created = new Date(now.getTime() - daysAgo * DAY);
  return {
    id: over.id ?? `t-${daysAgo}-${Math.random().toString(36).slice(2, 8)}`,
    text: over.text ?? `Lantern from ${daysAgo} days ago`,
    createdAt: created.toISOString(),
    returnAt: new Date(created.getTime() + 30 * DAY).toISOString(),
    status: over.status ?? 'rising',
    sky: over.sky ?? { x: 0.2 + (daysAgo % 5) * 0.12, y: 0.15 + (daysAgo % 3) * 0.12 },
    seed: over.seed ?? daysAgo * 7919,
    ...(over.kind ? { kind: over.kind } : {}),
  };
}

/** Seed stored lanterns through the app's hook, then reload so they load like real data. */
export async function seedLanterns(page: Page, query: string, lanterns: StoredLantern[]): Promise<void> {
  await openRitual(page, query);
  await page.evaluate((ls) => window.__lantern!.store.seed(ls as never), lanterns);
  await openRitual(page, query);
}
