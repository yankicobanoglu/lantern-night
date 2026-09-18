import { expect, test } from '@playwright/test';
import { PALETTE } from '../src/palette';
import { getLayout, openRitual, sampleRect, saveScreenshots } from './helpers';

/** ROADMAP 4.6: meteor showers raise the shooting-star rate; a supermoon is drawn a little larger. */
test.describe('real-night events', () => {
  test('the Perseids raise the shooting-star rate for the night', async ({ page }) => {
    await openRitual(page, 'date=2024-08-12');
    const night = await page.evaluate(() => window.__lantern!.night());
    expect(night.shower).toBe('Perseids');
    expect(night.rate).toBe(3);
    // A fresh session's first star follows the first-session rule; every interval the session schedules after that is divided by the rate.
    await page.evaluate(() => window.__lantern!.speed(40));
    await page.waitForFunction(() => Number.isFinite(window.__lantern!.starIn().interval), undefined, { timeout: 15_000 });
    const { interval } = await page.evaluate(() => window.__lantern!.starIn());
    expect(interval).toBeGreaterThanOrEqual(20 / 3);
    expect(interval).toBeLessThanOrEqual(60 / 3);
  });

  test('an ordinary night has no shower and the usual interval', async ({ page }) => {
    await openRitual(page, 'date=2024-09-10');
    const night = await page.evaluate(() => window.__lantern!.night());
    expect(night.shower).toBeNull();
    expect(night.rate).toBe(1);
    expect(night.supermoon).toBe(false);
    expect(night.moonSize).toBe(32);
    await page.evaluate(() => window.__lantern!.speed(40));
    await page.waitForFunction(() => Number.isFinite(window.__lantern!.starIn().interval), undefined, { timeout: 15_000 });
    const { interval } = await page.evaluate(() => window.__lantern!.starIn());
    expect(interval).toBeGreaterThanOrEqual(20);
    expect(interval).toBeLessThanOrEqual(60);
  });

  test('a supermoon night draws a 36 px full moon on the same grid', async ({ page }, testInfo) => {
    test.skip(!test.info().project.name.endsWith('-phone'), 'phone viewport only');
    // 2024-10-17: the Hunter's supermoon, the closest full moon of that year.
    await openRitual(page, 'date=2024-10-17');
    const night = await page.evaluate(() => window.__lantern!.night());
    expect(night.supermoon).toBe(true);
    expect(night.moonSize).toBe(36);
    expect(await page.evaluate(() => window.__lantern!.moonFrame())).toBe(4);
    const l = await getLayout(page);
    const px = await sampleRect(page, l.moon.x - 18, l.moon.y - 18, 36, 36);
    const lit = px.filter((c) => c === PALETTE.moon).length;
    expect(lit).toBeGreaterThanOrEqual(950); // π·17.5² ≈ 962; a 32 px disc is about 755
    expect(px.filter((c) => c === PALETTE.earthshine).length).toBe(0);
    await saveScreenshots(page, testInfo, 'supermoon');

    // A full moon near apogee (2024-02-24, a micromoon) stays at 32 px.
    await openRitual(page, 'date=2024-02-24');
    expect(await page.evaluate(() => window.__lantern!.moonFrame())).toBe(4);
    expect((await page.evaluate(() => window.__lantern!.night())).supermoon).toBe(false);
    const usual = await sampleRect(page, l.moon.x - 18, l.moon.y - 18, 36, 36);
    expect(usual.filter((c) => c === PALETTE.moon).length).toBeLessThan(800);
  });

  test('?supermoon pins the larger moon for screenshots, and the label still works', async ({ page }) => {
    await openRitual(page, 'date=2024-09-10&supermoon');
    expect((await page.evaluate(() => window.__lantern!.night())).moonSize).toBe(36);
    await page.getByRole('button', { name: 'Moon' }).click();
    await expect(page.locator('.moon-label p').nth(0)).toHaveText('First quarter');
  });
});
