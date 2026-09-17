import { expect, test } from '@playwright/test';
import { openRitual, readIdb, saveScreenshots } from './helpers';

test.describe('shooting star', () => {
  test('is tappable at the edge of its 64 px hit area, and a missed one earns the hint once', async ({ page }, testInfo) => {
    await openRitual(page, 'date=2024-09-10&star=now');
    // The star spawns on its own during arrive. Freeze the scene clock while it is crossing.
    await page.waitForFunction(() => window.__lantern!.star() !== null, undefined, { timeout: 8000 });
    await page.evaluate(() => window.__lantern!.speed(0));
    await page.waitForTimeout(100);
    const head = (await page.evaluate(() => window.__lantern!.star()))!;
    const l = await page.evaluate(() => window.__lantern!.layout);
    // Clear upper sky: never behind the moon, never in the bottom third.
    expect(head.y).toBeLessThan(l.horizon * l.cssScale * 0.75);
    expect(Math.hypot(head.x - l.moon.x * l.cssScale, head.y - l.moon.y * l.cssScale)).toBeGreaterThan(32 * l.cssScale);
    const box = await page.locator('.star-hit').boundingBox();
    expect(box?.width).toBe(64);
    expect(box?.height).toBe(64);
    await saveScreenshots(page, testInfo, 'shooting-star');

    // 31 px from the head, along the axis with the most room: inside the circle.
    const dx = head.x < l.width * l.cssScale / 2 ? 31 : -31;
    await page.mouse.click(head.x + dx, head.y);
    await expect(page.locator('.star-line')).toHaveText('Quick, a wish, just for you.');
    await expect(page.locator('.sparkle')).toHaveCount(1);
    await expect(page.locator('.star-hit')).toBeHidden();
    await expect(page.locator('.star-line')).toHaveText('Held close.', { timeout: 4000 });
    expect(await page.evaluate(() => window.__lantern!.state())).toBe('arrive');
    // Nothing stored.
    expect(await readIdb(page, 'lanterns')).toBeUndefined();
    const settings = (await readIdb(page, 'settings')) as { starHintShown?: boolean } | undefined;
    expect(settings?.starHintShown ?? false).toBe(false);

    // A star that passes untapped: the one-time hint.
    await page.evaluate(() => window.__lantern!.speed(1));
    expect(await page.evaluate(() => window.__lantern!.spawnStar())).toBe(true);
    await expect(page.locator('.toast')).toHaveText('Tap a shooting star to make a quick wish.', { timeout: 8000 });
    await expect.poll(() => readIdb(page, 'settings')).toMatchObject({ starHintShown: true });
    await page.locator('.toast').evaluate((n) => n.classList.remove('on'));
    expect(await page.evaluate(() => window.__lantern!.spawnStar())).toBe(true);
    await page.waitForTimeout(3800);
    await expect(page.locator('.toast')).toBeHidden();
  });

  test('a tap just outside the hit area does nothing', async ({ page }) => {
    await openRitual(page, 'date=2024-09-10&star=now');
    await page.waitForFunction(() => window.__lantern!.star() !== null, undefined, { timeout: 8000 });
    await page.evaluate(() => window.__lantern!.speed(0));
    await page.waitForTimeout(100);
    const head = (await page.evaluate(() => window.__lantern!.star()))!;
    await page.mouse.click(head.x, head.y + 40);
    await page.waitForTimeout(300);
    await expect(page.locator('.star-line')).not.toHaveClass(/on/);
    expect(await page.evaluate(() => window.__lantern!.star())).not.toBeNull();
  });
});

test.describe('moon label', () => {
  test('shows the phase and the next new or full moon for a mocked date', async ({ page }, testInfo) => {
    await openRitual(page, 'date=2024-09-18');
    await page.getByRole('button', { name: 'Moon' }).click();
    await expect(page.locator('.moon-label')).toBeVisible();
    await expect(page.locator('.moon-label p').nth(0)).toHaveText('Full moon');
    await expect(page.locator('.moon-label p').nth(1)).toHaveText('Full moon tonight.');
    await saveScreenshots(page, testInfo, 'moon-label');
    await page.getByRole('button', { name: 'Moon' }).click();
    await expect(page.locator('.moon-label')).toBeHidden();

    await openRitual(page, 'date=2024-09-10');
    await page.getByRole('button', { name: 'Moon' }).click();
    await expect(page.locator('.moon-label p').nth(0)).toHaveText('First quarter');
    await expect(page.locator('.moon-label p').nth(1)).toHaveText('Full moon in 8 days.');

    await openRitual(page, 'date=2024-09-19');
    await page.getByRole('button', { name: 'Moon' }).click();
    await expect(page.locator('.moon-label p').nth(1)).toHaveText('New moon in 14 days.');
  });

  test('the moon button covers the disc with at least 44 px', async ({ page }) => {
    await openRitual(page, 'date=2024-09-18');
    const box = await page.getByRole('button', { name: 'Moon' }).boundingBox();
    expect(box!.width).toBeGreaterThanOrEqual(44);
    expect(box!.height).toBeGreaterThanOrEqual(44);
  });
});
