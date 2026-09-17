import { expect, test, type Page } from '@playwright/test';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { foldLantern, lanternAt, openRitual, OUT_DIR, saveScreenshots, seedLanterns } from './helpers';

const QUIET = 'date=2024-09-10';
const FULL = 'date=2024-09-18';
const now = new Date('2024-09-10T21:00:00Z');

/** PNG width and height from the IHDR chunk. */
function pngSize(buf: Buffer): { width: number; height: number } {
  expect(buf.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

type Probe = { width: number; height: number; topLeft: number[]; brightBottom: number; moonLit: number; panelDark: number };

/** Decode a data URL in the page and measure a few regions. */
function probe(page: Page, dataUrl: string): Promise<Probe> {
  return page.evaluate(async (url) => {
    const img = new Image();
    img.src = url;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.width;
    c.height = img.height;
    const ctx = c.getContext('2d')!;
    ctx.drawImage(img, 0, 0);
    const px = (x: number, y: number): number[] => Array.from(ctx.getImageData(x, y, 1, 1).data).slice(0, 3);
    const count = (x0: number, y0: number, w: number, h: number, test: (r: number, g: number, b: number) => boolean): number => {
      const d = ctx.getImageData(x0, y0, w, h).data;
      let n = 0;
      for (let i = 0; i < d.length; i += 4) if (test(d[i]!, d[i + 1]!, d[i + 2]!)) n++;
      return n;
    };
    return {
      width: img.width,
      height: img.height,
      topLeft: px(2, 2),
      // Cream wordmark pixels in the bottom band.
      brightBottom: count(0, img.height - 140, img.width, 120, (r, g, b) => r > 200 && g > 200 && b > 150),
      // Moon disc: pale pixels around the upper-right moon position.
      moonLit: count(Math.round(img.width * 0.74) - 110, Math.round(img.height * 0.16) - 110, 220, 220, (r, g, b) => r > 220 && g > 210 && b > 180),
      // The wish panel region above the wordmark: cream text pixels.
      panelDark: count(150, img.height - 420, img.width - 300, 240, (r, g, b) => r > 200 && g > 200 && b > 150),
    };
  }, dataUrl);
}

test.describe('share image', () => {
  test('renders 1080×1920 with the scene, the moon, the wordmark and optionally the wish', async ({ page }) => {
    await seedLanterns(page, FULL, [lanternAt(2, now, { id: 'a', text: 'I am welcoming calm' }), lanternAt(9, now, { id: 'b' })]);
    const plain = await page.evaluate(() => window.__lantern!.shareImage());
    expect(plain.startsWith('data:image/png;base64,')).toBe(true);
    const size = pngSize(Buffer.from(plain.split(',')[1]!, 'base64'));
    expect(size).toEqual({ width: 1080, height: 1920 });
    const a = await probe(page, plain);
    expect(a.topLeft).toEqual([0x1b, 0x1b, 0x3a]);
    expect(a.brightBottom).toBeGreaterThan(400);
    expect(a.moonLit).toBeGreaterThan(2000);
    expect(a.panelDark).toBeLessThan(200);

    const withWish = await page.evaluate(() => window.__lantern!.shareImage('I am welcoming calm mornings and long, slow walks by the lake'));
    const b = await probe(page, withWish);
    expect(b.width).toBe(1080);
    expect(b.panelDark).toBeGreaterThan(1500);
    // The live scene is untouched by the offscreen render.
    expect(await page.evaluate(() => window.__lantern!.skyLights())).toBe(2);
    expect(await page.evaluate(() => window.__lantern!.state())).toBe('arrive');
  });

  test('from Your sky: preview, Include my wish for the selected light, and the download path', async ({ page }, testInfo) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'canShare', { value: undefined, configurable: true });
      Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
    });
    await seedLanterns(page, QUIET, [lanternAt(2, now, { id: 'a', text: 'I am welcoming calm' })]);
    await page.getByRole('button', { name: 'Menu' }).click();
    await page.getByRole('menuitem', { name: 'Your sky' }).click();
    // No light selected: the sheet opens without the wish toggle.
    await page.locator('.sky').getByRole('button', { name: 'Share my sky' }).click();
    await expect(page.locator('.share')).toBeVisible();
    await expect(page.locator('.share-preview')).toHaveAttribute('src', /^data:image\/png/, { timeout: 15_000 });
    await expect(page.getByRole('switch', { name: 'Include my wish' })).toBeHidden();
    await page.locator('.share').getByRole('button', { name: 'Close' }).click();
    await expect(page.locator('.share')).toBeHidden();
    await expect(page.locator('.sky')).toBeVisible();

    await page.locator('.sky-light[data-id="a"]').click();
    await page.locator('.sky').getByRole('button', { name: 'Share my sky' }).click();
    await expect(page.locator('.share-preview')).toHaveAttribute('src', /^data:image\/png/, { timeout: 15_000 });
    const before = await page.locator('.share-preview').getAttribute('src');
    const toggle = page.getByRole('switch', { name: 'Include my wish' });
    await expect(toggle).toBeVisible();
    await expect(toggle).toHaveAttribute('aria-checked', 'false');
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-checked', 'true');
    await expect.poll(async () => page.locator('.share-preview').getAttribute('src'), { timeout: 15_000 }).not.toBe(before);
    await saveScreenshots(page, testInfo, 'share-sheet');
    const withWish = (await page.locator('.share-preview').getAttribute('src'))!;
    expect((await probe(page, withWish)).panelDark).toBeGreaterThan(1000);

    const [download] = await Promise.all([page.waitForEvent('download', { timeout: 15_000 }), page.locator('.share .btn.primary').click()]);
    expect(download.suggestedFilename()).toBe('lantern-night-2024-09-10.png');
    const file = readFileSync((await download.path())!);
    expect(pngSize(file)).toEqual({ width: 1080, height: 1920 });
    expect(file.length).toBeGreaterThan(20_000);
    // Keep the real image next to the screenshots for review.
    mkdirSync(OUT_DIR, { recursive: true });
    writeFileSync(join(OUT_DIR, `${testInfo.project.name}-share-image.png`), file);
  });

  test('from the corner menu, at any time', async ({ page }) => {
    await openRitual(page, QUIET);
    await page.getByRole('button', { name: 'Menu' }).click();
    await page.getByRole('menuitem', { name: 'Share my sky' }).click();
    await expect(page.locator('.share')).toBeVisible();
    await expect(page.locator('.share-preview')).toHaveAttribute('src', /^data:image\/png/, { timeout: 15_000 });
    await expect(page.getByRole('switch', { name: 'Include my wish' })).toBeHidden();
    // The file is ready before the tap, so iOS can open its sheet inside the gesture.
    await page.locator('.share').getByRole('button', { name: 'Close' }).click();
    await expect(page.locator('.share')).toBeHidden();
    expect(await page.evaluate(() => window.__lantern!.state())).toBe('arrive');
    await expect(page.locator('.arrive')).toBeVisible();
  });

  test('from the watch state, with the wish just released', async ({ page }) => {
    await openRitual(page, QUIET);
    await foldLantern(page, 'I trust that it works out');
    await page.evaluate(() => window.__lantern!.light());
    await page.getByRole('button', { name: 'Let it rise' }).click();
    await page.waitForSelector('#ui[data-state="watch"]');
    await page.evaluate(() => window.__lantern!.speed(8));
    await expect(page.locator('.stage').getByRole('button', { name: 'Share my sky' })).toBeVisible({ timeout: 15_000 });
    await page.evaluate(() => window.__lantern!.speed(1));
    await page.locator('.stage').getByRole('button', { name: 'Share my sky' }).click();
    await expect(page.locator('.share')).toBeVisible();
    await expect(page.getByRole('switch', { name: 'Include my wish' })).toBeVisible();
    await expect(page.locator('.share-preview')).toHaveAttribute('src', /^data:image\/png/, { timeout: 15_000 });
    await page.keyboard.press('Escape');
    await expect(page.locator('.share')).toBeHidden();
    expect(await page.evaluate(() => window.__lantern!.state())).toBe('watch');
    await expect(page.getByRole('button', { name: 'Goodnight' })).toBeVisible();
  });
});
