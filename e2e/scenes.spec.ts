import { expect, test, type Page } from '@playwright/test';
import { PALETTE } from '../src/palette';
import { foldLantern, getLayout, lanternAt, openRitual, readIdb, sampleRect, saveScreenshots, seedLanterns } from './helpers';

/** ROADMAP 4.1: the water scene, chosen in Settings, sharing copy, storage and audio with the sky scene. */
const QUIET = 'date=2024-09-10';
const WARM: number[] = [PALETTE.lantern, PALETTE.lanternCore, PALETTE.ember, PALETTE.flame];
const now = new Date('2024-09-10T21:00:00Z');

async function openMenu(page: Page, item: 'Your sky' | 'Settings'): Promise<void> {
  await page.getByRole('button', { name: 'Menu' }).click();
  await page.getByRole('menuitem', { name: item }).click();
}

/** The 20×15 water lantern's pixels at its rest point. */
async function waterRestRect(page: Page): Promise<number[]> {
  const l = await getLayout(page);
  const rest = await page.evaluate(() => window.__lantern!.layout.waterRest);
  void l;
  return sampleRect(page, rest.x - 10, rest.y - 8, 20, 16);
}

test.describe('water lanterns', () => {
  test('the lantern waits on the water, lights from the bottom, drifts across the lake and settles as a light on it', async ({ page }, testInfo) => {
    await openRitual(page, `${QUIET}&scene=water&sky=5`);
    expect(await page.evaluate(() => window.__lantern!.sceneKind())).toBe('water');
    const l = await getLayout(page);
    // Seeded lights sit on the lake, not in the sky: the warm dots are between the shoreline rows.
    const lake = await sampleRect(page, 0, l.hillsEnd, l.width, l.lakeEnd - l.hillsEnd);
    expect(lake.filter((c) => WARM.includes(c)).length).toBeGreaterThanOrEqual(5 * 4);
    const sky = await sampleRect(page, 0, 0, l.width, l.horizon);
    expect(sky.filter((c) => c === PALETTE.lantern || c === PALETTE.lanternCore).length).toBeLessThan(20); // the two cottage windows only
    await saveScreenshots(page, testInfo, 'water-arrive');

    await foldLantern(page, 'I am welcoming calm');
    const unlit = await waterRestRect(page);
    expect(unlit.filter((c) => c === PALETTE.plum).length).toBeGreaterThanOrEqual(60);
    expect(unlit.filter((c) => c === PALETTE.woodDark).length).toBeGreaterThanOrEqual(20);
    expect(unlit.filter((c) => WARM.includes(c)).length).toBe(0);
    await expect(page.locator('#ui .hint')).toHaveText('Hold to light your lantern');
    await saveScreenshots(page, testInfo, 'water-unlit');

    await page.getByRole('button', { name: 'Light it' }).click();
    await page.waitForFunction(() => window.__lantern!.hold().state === 'lit', undefined, { timeout: 4000 });
    await expect(page.locator('#ui .hint')).toHaveText('Beautiful. Now breathe out, and let it drift.');
    await expect(page.getByRole('button', { name: 'Let it drift' })).toBeVisible();
    const lit = await waterRestRect(page);
    expect(lit.filter((c) => c === PALETTE.lantern || c === PALETTE.lanternCore).length).toBeGreaterThanOrEqual(60);
    expect(lit.filter((c) => c === PALETTE.flame || c === PALETTE.lanternCore).length).toBeGreaterThanOrEqual(2);
    await page.waitForTimeout(300);
    await saveScreenshots(page, testInfo, 'water-lit');

    const before = await page.evaluate(() => window.__lantern!.skyLights());
    await page.getByRole('button', { name: 'Let it drift' }).click();
    await page.waitForFunction(() => window.__lantern!.lanterns().some((x) => x.phase === 'rising'), undefined, { timeout: 2000 });
    await expect(page.locator('#ui .hint')).toHaveText('There it goes.');
    // Stored like any wish, with a normalised point that the lake field interprets.
    const stored = (await readIdb(page, 'lanterns')) as { sky: { x: number; y: number } }[];
    expect(stored).toHaveLength(1);
    expect(stored[0]!.sky.y).toBeGreaterThan(0);
    expect(stored[0]!.sky.y).toBeLessThan(1);

    await page.waitForTimeout(2500);
    const mid = await page.evaluate(() => window.__lantern!.lanterns().find((x) => x.phase === 'rising')!);
    expect(mid.p).toBeGreaterThan(0.05);
    expect(mid.p).toBeLessThan(0.6);
    // It stays on the lake the whole way.
    expect(mid.y).toBeGreaterThan(l.hillsEnd);
    expect(mid.y).toBeLessThan(l.lakeEnd);
    await saveScreenshots(page, testInfo, 'water-drifting');

    await page.evaluate(() => window.__lantern!.speed(6));
    await expect(page.getByRole('button', { name: 'Light another' })).toBeVisible({ timeout: 15_000 });
    await page.waitForFunction((n) => window.__lantern!.skyLights() === n + 1, before, { timeout: 15_000 });
    await page.evaluate(() => window.__lantern!.speed(1));
    await page.waitForTimeout(300);
    const after = await sampleRect(page, 0, l.hillsEnd, l.width, l.lakeEnd - l.hillsEnd);
    expect(after.filter((c) => WARM.includes(c)).length).toBeGreaterThan(lake.filter((c) => WARM.includes(c)).length);
    await saveScreenshots(page, testInfo, 'water-settled');
  });

  test('Your sky places the rings on the lake in the water scene', async ({ page }) => {
    const ls = [lanternAt(2, now, { id: 'a', text: 'I am welcoming calm' }), lanternAt(9, now, { id: 'b', text: 'I trust that it works out' })];
    await seedLanterns(page, `${QUIET}&scene=water`, ls);
    await openMenu(page, 'Your sky');
    await expect(page.locator('.sky-light')).toHaveCount(2);
    const l = await getLayout(page);
    for (const b of await page.locator('.sky-light').all()) {
      const top = parseFloat(await b.evaluate((n) => (n as HTMLElement).style.top));
      expect(top).toBeGreaterThan(l.hillsEnd * l.cssScale);
      expect(top).toBeLessThan(l.lakeEnd * l.cssScale);
    }
    await page.locator('.sky-light[data-id="b"]').click();
    await expect(page.locator('.sky-card .quote')).toHaveText('I trust that it works out');
  });

  test('the Scene setting is stored, swaps the world live and survives a reload', async ({ page }, testInfo) => {
    const ls = [lanternAt(2, now, { id: 'a', text: 'I am welcoming calm' }), lanternAt(9, now, { id: 'b' })];
    await seedLanterns(page, QUIET, ls);
    expect(await page.evaluate(() => window.__lantern!.sceneKind())).toBe('sky');
    await openMenu(page, 'Settings');
    await expect(page.getByRole('button', { name: 'Sky lanterns' })).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('button', { name: 'Water lanterns' }).click();
    await expect(page.getByRole('button', { name: 'Water lanterns' })).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(() => readIdb(page, 'settings')).toMatchObject({ scene: 'water' });
    await expect.poll(() => page.evaluate(() => window.__lantern!.sceneKind())).toBe('water');
    // Every light carried over.
    expect(await page.evaluate(() => window.__lantern!.skyLights())).toBe(2);
    await saveScreenshots(page, testInfo, 'settings-scene');
    await page.getByRole('button', { name: 'Close' }).click();

    // Survives a reload, and the ritual runs in the new world.
    await openRitual(page, QUIET);
    expect(await page.evaluate(() => window.__lantern!.sceneKind())).toBe('water');
    await foldLantern(page, 'I am welcoming calm');
    await expect(page.getByRole('button', { name: 'Light it' })).toBeVisible();
    const rest = await page.evaluate(() => window.__lantern!.layout.waterRest);
    const waiting = await page.evaluate(() => window.__lantern!.lanterns().find((x) => x.phase === 'unlit')!);
    expect(Math.abs(waiting.y - rest.y)).toBeLessThan(3);

    // Back to the sky while a lantern waits: it waits again on the shore, with its words.
    await openMenu(page, 'Settings');
    await page.getByRole('button', { name: 'Sky lanterns' }).click();
    await expect.poll(() => page.evaluate(() => window.__lantern!.sceneKind())).toBe('sky');
    await page.getByRole('button', { name: 'Close' }).click();
    await expect(page.locator('#ui .wish')).toHaveText('I am welcoming calm');
    await expect(page.locator('#ui .hint')).toHaveText('Hold to light your lantern');
    const skyRest = await page.evaluate(() => window.__lantern!.layout.lanternRest);
    const again = await page.evaluate(() => window.__lantern!.lanterns().find((x) => x.phase === 'unlit')!);
    expect(Math.abs(again.y - skyRest.y)).toBeLessThan(3);
    expect(await page.evaluate(() => window.__lantern!.hold().state)).toBe('idle');
  });

  test('switching scenes while a lantern is on its way settles it and keeps the watch buttons', async ({ page }) => {
    await openRitual(page, QUIET);
    await foldLantern(page, 'I am welcoming calm');
    await page.getByRole('button', { name: 'Light it' }).click();
    await page.waitForFunction(() => window.__lantern!.hold().state === 'lit');
    await page.getByRole('button', { name: 'Let it rise' }).click();
    await page.waitForSelector('#ui[data-state="watch"]');
    await openMenu(page, 'Settings');
    await page.getByRole('button', { name: 'Water lanterns' }).click();
    await expect.poll(() => page.evaluate(() => window.__lantern!.sceneKind())).toBe('water');
    await page.getByRole('button', { name: 'Close' }).click();
    expect(await page.evaluate(() => window.__lantern!.lanterns().length)).toBe(0);
    expect(await page.evaluate(() => window.__lantern!.skyLights())).toBe(1);
    await expect(page.getByRole('button', { name: 'Light another' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Goodnight' })).toBeVisible();
    expect(await page.evaluate(() => window.__lantern!.state())).toBe('watch');
  });

  test('the share image is composed for the water scene', async ({ page }) => {
    test.skip(!test.info().project.name.startsWith('chromium'), 'chromium only (share render)');
    await openRitual(page, `${QUIET}&scene=water&sky=3`);
    const url = await page.evaluate(() => window.__lantern!.shareImage(null));
    expect(url.startsWith('data:image/png')).toBe(true);
    expect(url.length).toBeGreaterThan(20_000);
  });
});
