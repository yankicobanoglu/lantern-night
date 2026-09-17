import { expect, test, type Page } from '@playwright/test';
import { getLayout, openRitual, openScene, sampleRect, saveScreenshots } from './helpers';

const APRICOT = 0xe8a07a;
const BLUSH = 0xd98a84;
const ROSE = 0xa86a8c;
const PLUM = 0x6b4e8c;

/** Count each warm sky colour in the pixel world above the horizon. */
async function warmCounts(page: Page): Promise<{ apricot: number; blush: number; rose: number; plum: number }> {
  const L = await getLayout(page);
  const px = await sampleRect(page, 0, 0, L.width, L.horizon);
  const count = (c: number): number => px.filter((v) => v === c).length;
  return { apricot: count(APRICOT), blush: count(BLUSH), rose: count(ROSE), plum: count(PLUM) };
}

test.describe('session light arc (SPEC section 3: the horizon eases from apricot to plum over ~3 minutes)', () => {
  test('evening 0: the M1 sky, apricot at the horizon', async ({ page }, testInfo) => {
    await openScene(page, 'date=2026-09-17&evening=0');
    const c = await warmCounts(page);
    expect(c.apricot).toBeGreaterThan(0);
    expect(c.blush).toBeGreaterThan(0);
    expect(c.rose).toBeGreaterThan(0);
    await saveScreenshots(page, testInfo, 'arc-0');
  });

  test('evening 0.5: apricot is gone, blush is thinning, rose is still there', async ({ page }, testInfo) => {
    await openScene(page, 'date=2026-09-17&evening=0');
    const start = await warmCounts(page);
    await openScene(page, 'date=2026-09-17&evening=0.5');
    const c = await warmCounts(page);
    expect(c.apricot).toBe(0);
    expect(c.blush).toBeGreaterThan(0);
    expect(c.blush).toBeLessThan(start.blush * 0.75);
    // Rose keeps its height but has moved down behind the far ridge, so fewer of its pixels show.
    expect(c.rose).toBeGreaterThan(start.rose * 0.5);
    await saveScreenshots(page, testInfo, 'arc-half');
  });

  test('evening 1: plum meets the hills, no warm band left', async ({ page }, testInfo) => {
    await openScene(page, 'date=2026-09-17&evening=1');
    const c = await warmCounts(page);
    expect(c.apricot).toBe(0);
    expect(c.blush).toBe(0);
    expect(c.rose).toBe(0);
    expect(c.plum).toBeGreaterThan(0);
    // The band touching the hills is plum: the last 16 rows above the horizon hold plum and no violet
    // (the dithered plum/violet edge ends above them; the far ridge reaches at most 16 rows up).
    const L = await getLayout(page);
    const rows = await sampleRect(page, 0, L.horizon - 16, L.width, 16);
    expect(rows.filter((v) => v === PLUM).length).toBeGreaterThan(L.width * 4);
    expect(rows.filter((v) => v === 0x4a3b72).length).toBe(0);
    await saveScreenshots(page, testInfo, 'arc-1');
  });

  test('the arc runs on the session clock and the share image follows it', async ({ page }) => {
    await openRitual(page, 'date=2026-09-17');
    expect(await page.evaluate(() => window.__lantern!.evening())).toBeLessThan(0.05);
    const before = await warmCounts(page);
    expect(before.apricot).toBeGreaterThan(0);
    await page.evaluate(() => window.__lantern!.speed(30));
    await page.waitForTimeout(3500);
    await page.evaluate(() => window.__lantern!.speed(1));
    const evening = await page.evaluate(() => window.__lantern!.evening());
    expect(evening).toBeGreaterThan(0.35);
    const after = await warmCounts(page);
    expect(after.apricot).toBe(0);
    // The share image is composed at the same evening: no apricot row in its sky either.
    const apricotInShare = await page.evaluate(async () => {
      const url = await window.__lantern!.shareImage(null);
      const img = new Image();
      img.src = url;
      await img.decode();
      const c = document.createElement('canvas');
      c.width = img.width;
      c.height = img.height;
      const ctx = c.getContext('2d')!;
      ctx.drawImage(img, 0, 0);
      const d = ctx.getImageData(0, 0, c.width, Math.floor(c.height * 0.55)).data;
      let n = 0;
      for (let i = 0; i < d.length; i += 4) if (d[i] === 0xe8 && d[i + 1] === 0xa0 && d[i + 2] === 0x7a) n++;
      return n;
    });
    expect(apricotInShare).toBe(0);
  });
});
