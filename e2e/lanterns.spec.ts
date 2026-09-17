import { expect, test, type Page } from '@playwright/test';
import { PALETTE } from '../src/palette';
import { getLayout, openScene, sampleRect, saveScreenshots } from './helpers';

const WARM: number[] = [PALETTE.lantern, PALETTE.lanternCore, PALETTE.ember, PALETTE.flame];

async function restingRect(page: Page): Promise<number[]> {
  const { lanternRest: rest } = await getLayout(page);
  return sampleRect(page, rest.x - 10, rest.y - 13, 20, 26);
}

function restCss(page: Page): Promise<{ x: number; y: number }> {
  return page.evaluate(() => {
    const l = window.__lantern!.layout;
    return { x: l.lanternRest.x * l.cssScale, y: l.lanternRest.y * l.cssScale };
  });
}

test.describe('lanterns', () => {
  test('an unlit lantern waits on the shore, in plum', async ({ page }, testInfo) => {
    await openScene(page, 'date=2026-09-17');
    const hold = await page.evaluate(() => window.__lantern!.hold());
    expect(hold.state).toBe('idle');
    const px = await restingRect(page);
    expect(px.filter((c) => c === PALETTE.plum).length).toBeGreaterThanOrEqual(150);
    expect(px.filter((c) => WARM.includes(c)).length).toBe(0);
    await expect(page.locator('#ui .hint')).toHaveText('Hold to light your lantern');
    await expect(page.locator('#ui .hint')).toHaveClass(/left/);
    await expect(page.getByRole('button', { name: 'Light it' })).toBeVisible();
    await saveScreenshots(page, testInfo, 'lantern-unlit');
  });

  test('letting go early eases the fill back down with no failure state', async ({ page }) => {
    await openScene(page, 'date=2026-09-17');
    const { x, y } = await restCss(page);
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.waitForTimeout(1200);
    const mid = await page.evaluate(() => window.__lantern!.hold());
    expect(mid.state).toBe('holding');
    expect(mid.fill).toBeGreaterThan(0.15);
    expect(mid.fill).toBeLessThan(0.6);
    await expect(page.locator('#ui .hint')).toHaveText('Breathe in…');
    await page.mouse.up();
    await page.waitForFunction(() => window.__lantern!.hold().state === 'idle', undefined, { timeout: 4000 });
    expect((await page.evaluate(() => window.__lantern!.hold())).fill).toBe(0);
    await expect(page.locator('#ui .hint')).toHaveText('Hold to light your lantern');
  });

  test('hold for 4 s to light, swipe up to release, rise and hand off to the sky', async ({ page }, testInfo) => {
    await openScene(page, 'date=2026-09-17');
    const { x, y } = await restCss(page);
    const skyBefore = await page.evaluate(() => window.__lantern!.skyLights());

    // Hold: the breath ring expands and the paper fills.
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.waitForTimeout(2000);
    await saveScreenshots(page, testInfo, 'lantern-holding');
    const half = await page.evaluate(() => window.__lantern!.hold());
    expect(half.fill).toBeGreaterThan(0.3);
    await page.waitForFunction(() => window.__lantern!.hold().state === 'lit', undefined, { timeout: 5000 });
    await page.mouse.up();
    await expect(page.locator('#ui .hint')).toHaveText('Beautiful. Now breathe out, and let it rise.');
    await expect(page.getByRole('button', { name: 'Let it rise' })).toBeVisible();
    const lit = await restingRect(page);
    expect(lit.filter((c) => c === PALETTE.lantern).length).toBeGreaterThanOrEqual(120);
    expect(lit.filter((c) => c === PALETTE.flame || c === PALETTE.lanternCore).length).toBeGreaterThanOrEqual(2);
    await page.waitForTimeout(300);
    await saveScreenshots(page, testInfo, 'lantern-lit');

    // Swipe up: mostly vertical, more than 60 CSS px. The page must not scroll.
    await page.mouse.move(x, y + 40);
    await page.mouse.down();
    await page.mouse.move(x + 8, y - 80, { steps: 8 });
    await page.mouse.up();
    await page.waitForFunction(() => window.__lantern!.lanterns().some((l) => l.phase === 'rising'), undefined, { timeout: 2000 });
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
    await expect(page.locator('#ui .hint')).toHaveText('There it goes.');
    await page.waitForTimeout(2500);
    await expect(page.locator('#ui .hint')).toHaveText('Your light is on its way.');
    const mid = await page.evaluate(() => window.__lantern!.lanterns().find((l) => l.phase === 'rising')!);
    expect(mid.p).toBeGreaterThan(0.05);
    expect(mid.p).toBeLessThan(0.5);
    await saveScreenshots(page, testInfo, 'lantern-rising');

    // No fresh lantern yet: the next one waits until this one has passed half of the sky.
    expect(await page.evaluate(() => window.__lantern!.lanterns().some((l) => l.phase === 'unlit'))).toBe(false);
    await expect(page.locator('#ui .hint')).toHaveClass(/left/);

    // Speed time up: the next lantern appears once the first is above the middle of the sky (or already small).
    await page.evaluate(() => window.__lantern!.speed(8));
    await page.waitForFunction(() => window.__lantern!.lanterns().some((l) => l.phase === 'unlit'), undefined, { timeout: 15_000 });
    const risen = await page.evaluate(() => window.__lantern!.lanterns().find((l) => l.phase === 'rising')!);
    const { horizon } = await getLayout(page);
    expect(risen.y <= horizon * 0.5 + 8 || risen.p >= 0.85).toBe(true);
    await expect(page.locator('#ui .hint')).toHaveText('Hold to light your lantern');

    // Wait for the hand-off.
    await page.waitForFunction((n) => window.__lantern!.skyLights() === n + 1, skyBefore, { timeout: 15_000 });
    await page.evaluate(() => window.__lantern!.speed(1));
    expect(await page.evaluate(() => window.__lantern!.lanterns().filter((l) => l.phase === 'rising').length)).toBe(0);
    await page.waitForTimeout(300);
    await saveScreenshots(page, testInfo, 'lantern-settled');
  });

  test('the tap alternative lights the lantern and the button releases it', async ({ page }) => {
    await openScene(page, 'date=2026-09-17&motion=gentle');
    await page.getByRole('button', { name: 'Light it' }).click();
    await page.waitForFunction(() => window.__lantern!.hold().state === 'lit', undefined, { timeout: 4000 });
    await page.getByRole('button', { name: 'Let it rise' }).click();
    await page.waitForFunction(() => window.__lantern!.lanterns().some((l) => l.phase === 'rising'), undefined, { timeout: 2000 });
  });

  test('never more than 12 rising lanterns', async ({ page }) => {
    await openScene(page, 'date=2026-09-17&lanterns=12');
    const n = await page.evaluate(() => window.__lantern!.lanterns().filter((l) => l.phase === 'rising').length);
    expect(n).toBe(12);
    await page.evaluate(() => window.__lantern!.light());
    await page.evaluate(() => window.__lantern!.release());
    const after = await page.evaluate(() => ({
      rising: window.__lantern!.lanterns().filter((l) => l.phase === 'rising').length,
      sky: window.__lantern!.skyLights(),
    }));
    expect(after.rising).toBe(12);
    expect(after.sky).toBe(1);
  });
});
