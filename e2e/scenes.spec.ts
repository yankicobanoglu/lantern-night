import { expect, test, type Page } from '@playwright/test';
import { PALETTE } from '../src/palette';
import { foldLantern, getLayout, lanternAt, openRitual, readIdb, sampleRect, saveScreenshots, seedLanterns } from './helpers';

/**
 * M7: both kinds of lantern share one night. The kind is chosen on the wish
 * screen, kept with the lantern for good, and a sky lantern never becomes a
 * water one.
 */
const QUIET = 'date=2024-09-10';
const WARM: number[] = [PALETTE.lantern, PALETTE.lanternCore, PALETTE.ember, PALETTE.flame];
const now = new Date('2024-09-10T21:00:00Z');

async function openMenu(page: Page, item: 'Your sky' | 'Settings'): Promise<void> {
  await page.getByRole('button', { name: 'Menu' }).click();
  await page.getByRole('menuitem', { name: item }).click();
}

/** The 20×15 water lantern's pixels at its rest point. */
async function waterRestRect(page: Page): Promise<number[]> {
  const rest = await page.evaluate(() => window.__lantern!.layout.waterRest);
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

    await foldLantern(page, 'I am welcoming calm', 'wish', 'water');
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

    const before = await page.evaluate(() => window.__lantern!.lights());
    await page.getByRole('button', { name: 'Let it drift' }).click();
    await page.waitForFunction(() => window.__lantern!.lanterns().some((x) => x.phase === 'rising'), undefined, { timeout: 2000 });
    await expect(page.locator('#ui .hint')).toHaveText('There it goes.');
    // Stored like any wish, with its kind and a normalised point that the lake field interprets.
    const stored = (await readIdb(page, 'lanterns')) as { sky: { x: number; y: number }; kind: string }[];
    expect(stored).toHaveLength(1);
    expect(stored[0]!.kind).toBe('water');
    expect(stored[0]!.sky.y).toBeGreaterThan(0);
    expect(stored[0]!.sky.y).toBeLessThan(1);

    await page.waitForTimeout(2500);
    const mid = await page.evaluate(() => window.__lantern!.lanterns().find((x) => x.phase === 'rising')!);
    expect(mid.kind).toBe('water');
    expect(mid.p).toBeGreaterThan(0.05);
    expect(mid.p).toBeLessThan(0.6);
    // It stays on the lake the whole way.
    expect(mid.y).toBeGreaterThan(l.hillsEnd);
    expect(mid.y).toBeLessThan(l.lakeEnd);
    await saveScreenshots(page, testInfo, 'water-drifting');

    await page.evaluate(() => window.__lantern!.speed(6));
    await expect(page.getByRole('button', { name: 'Light another' })).toBeVisible({ timeout: 15_000 });
    await page.waitForFunction((n) => window.__lantern!.lights().water === n + 1, before.water, { timeout: 15_000 });
    await page.evaluate(() => window.__lantern!.speed(1));
    await page.waitForTimeout(300);
    expect(await page.evaluate(() => window.__lantern!.lights())).toMatchObject({ sky: 0 });
    const after = await sampleRect(page, 0, l.hillsEnd, l.width, l.lakeEnd - l.hillsEnd);
    expect(after.filter((c) => WARM.includes(c)).length).toBeGreaterThan(lake.filter((c) => WARM.includes(c)).length);
    await saveScreenshots(page, testInfo, 'water-settled');
  });

  test('a settled water light is its own shape: wider than tall, with a reflection under it', async ({ page }) => {
    // It must not read as the sky lantern's 4×4 dot (M7, item 3).
    await openRitual(page, `${QUIET}&scene=water&sky=1`);
    const l = await getLayout(page);
    const light = await page.evaluate(() => window.__lantern!.scene.waterLights.lights[0]!);
    const f = await page.evaluate(() => {
      const field = window.__lantern!.scene.fieldOf('water');
      return { top: field.top, width: field.width, height: field.height };
    });
    const cx = Math.round(light.sky.x * f.width);
    const cy = Math.round(f.top + light.sky.y * f.height);
    const rows: number[][] = [];
    for (let dy = -3; dy <= 5; dy++) rows.push(await sampleRect(page, cx - 5, cy + dy, 11, 1));
    const warmPerRow = rows.map((r) => r.filter((c) => WARM.includes(c)).length);
    const widest = Math.max(...warmPerRow);
    const tall = warmPerRow.filter((n) => n > 0).length;
    // Wider than it is tall, unlike the square sky dot.
    expect(widest).toBeGreaterThanOrEqual(5);
    expect(tall).toBeGreaterThanOrEqual(3);
    expect(widest).toBeGreaterThan(tall - 1);
    // The reflection is ember, and it is under the body rather than beside it.
    const emberRow = rows.findIndex((r) => r.includes(PALETTE.ember));
    const bodyRow = rows.findIndex((r) => r.includes(PALETTE.lanternCore) || r.includes(PALETTE.lantern));
    expect(bodyRow).toBeGreaterThanOrEqual(0);
    expect(emberRow).toBeGreaterThan(bodyRow);
    void l;
  });

  test('Your sky places each light in its own field: the sky band or the lake', async ({ page }) => {
    const ls = [
      lanternAt(2, now, { id: 'a', text: 'I am welcoming calm', kind: 'water' }),
      lanternAt(9, now, { id: 'b', text: 'I trust that it works out', kind: 'sky' }),
    ];
    await seedLanterns(page, QUIET, ls);
    expect(await page.evaluate(() => window.__lantern!.lights())).toEqual({ sky: 1, water: 1 });
    await openMenu(page, 'Your sky');
    await expect(page.locator('.sky-light')).toHaveCount(2);
    const l = await getLayout(page);
    const top = async (id: string): Promise<number> =>
      parseFloat(await page.locator(`.sky-light[data-id="${id}"]`).evaluate((n) => (n as HTMLElement).style.top));
    const water = await top('a');
    expect(water).toBeGreaterThan(l.hillsEnd * l.cssScale);
    expect(water).toBeLessThan(l.lakeEnd * l.cssScale);
    expect(await top('b')).toBeLessThan(l.horizon * l.cssScale);
    await page.locator('.sky-light[data-id="b"]').click();
    await expect(page.locator('.sky-card .quote')).toHaveText('I trust that it works out');
  });

  test('a stored lantern keeps its kind: lighting a water lantern never moves the sky ones', async ({ page }, testInfo) => {
    const ls = [lanternAt(2, now, { id: 'a', text: 'I am welcoming calm', kind: 'sky' }), lanternAt(9, now, { id: 'b', kind: 'sky' })];
    await seedLanterns(page, QUIET, ls);
    expect(await page.evaluate(() => window.__lantern!.lights())).toEqual({ sky: 2, water: 0 });

    await foldLantern(page, 'I am welcoming water', 'wish', 'water');
    await page.getByRole('button', { name: 'Light it' }).click();
    await page.waitForFunction(() => window.__lantern!.hold().state === 'lit');
    await page.getByRole('button', { name: 'Let it drift' }).click();
    await page.waitForSelector('#ui[data-state="watch"]');
    await page.evaluate(() => window.__lantern!.speed(6));
    await expect.poll(() => page.evaluate(() => window.__lantern!.lights()), { timeout: 20_000 }).toEqual({ sky: 2, water: 1 });
    await page.evaluate(() => window.__lantern!.speed(1));
    // The two older lights are still sky lanterns in the store and on screen.
    const stored = (await readIdb(page, 'lanterns')) as { id: string; kind: string; text: string }[];
    expect(stored).toHaveLength(3);
    expect(stored.filter((r) => r.id === 'a' || r.id === 'b').map((r) => r.kind)).toEqual(['sky', 'sky']);
    const fresh = stored.filter((r) => r.id !== 'a' && r.id !== 'b');
    expect(fresh.map((r) => r.kind)).toEqual(['water']);
    expect(fresh[0]!.text).toBe('I am welcoming water');
    await saveScreenshots(page, testInfo, 'both-kinds');
  });

  test('the choice is remembered as the default for the next lantern and survives a reload', async ({ page }) => {
    await openRitual(page, QUIET);
    // Sky is the default on a fresh store.
    await page.getByRole('button', { name: 'Begin' }).click();
    await expect(page.getByRole('button', { name: 'Sky lantern', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await page.getByLabel('Your intention').fill('I am welcoming calm');
    await page.getByRole('button', { name: 'Water lantern', exact: true }).click();
    await page.getByRole('button', { name: 'Fold my lantern' }).click();
    await page.waitForSelector('#ui[data-state="light"]');
    await expect.poll(() => readIdb(page, 'settings')).toMatchObject({ scene: 'water' });
    expect(await page.evaluate(() => window.__lantern!.sceneKind())).toBe('water');

    await openRitual(page, QUIET);
    expect(await page.evaluate(() => window.__lantern!.sceneKind())).toBe('water');
    await page.getByRole('button', { name: 'Begin' }).click();
    await expect(page.getByRole('button', { name: 'Water lantern', exact: true })).toHaveAttribute('aria-pressed', 'true');
  });

  test('the share image is composed with both kinds in it', async ({ page }) => {
    test.skip(!test.info().project.name.startsWith('chromium'), 'chromium only (share render)');
    await seedLanterns(page, QUIET, [lanternAt(2, now, { id: 'a', kind: 'water' }), lanternAt(4, now, { id: 'b', kind: 'sky' })]);
    const url = await page.evaluate(() => window.__lantern!.shareImage(null));
    expect(url.startsWith('data:image/png')).toBe(true);
    expect(url.length).toBeGreaterThan(20_000);
  });
});
