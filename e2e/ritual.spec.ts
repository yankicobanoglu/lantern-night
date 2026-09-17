import { expect, test } from '@playwright/test';
import { lanternAt, openRitual, readIdb, saveScreenshots, seedLanterns, type StoredLantern } from './helpers';

/** 2024-09-10: first quarter, no banner, wish by default. 2024-09-18: full moon. */
const QUIET = 'date=2024-09-10';
const FULL = 'date=2024-09-18';

test.describe('the ritual', () => {
  test('wish flow: arrive → intention → light → release → watch → goodnight, and the lantern is stored', async ({ page }, testInfo) => {
    await openRitual(page, QUIET);
    await expect(page.locator('.arrive .line')).toHaveText('Welcome. The evening is quiet tonight.');
    await expect(page.locator('.arrive .banner')).toBeHidden();
    await expect(page.locator('.title')).toHaveText('Lantern Night');
    await saveScreenshots(page, testInfo, 'ritual-arrive');

    await page.getByRole('button', { name: 'Begin' }).click();
    await page.waitForSelector('#ui[data-state="intention"]');
    await expect(page.getByRole('button', { name: 'Make a wish' })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.intention .heading')).toHaveText('What would you like to grow toward?');
    await expect(page.getByLabel('Your intention')).toHaveAttribute('placeholder', 'I am welcoming…');
    await expect(page.locator('.intention .chip')).toHaveCount(8);
    await expect(page.getByRole('button', { name: 'Fold my lantern' })).toBeDisabled();

    // A chip starts the sentence (its ellipsis dropped), typing continues it; the field caps at 120.
    await page.getByRole('button', { name: 'I am becoming…' }).click();
    await expect(page.getByLabel('Your intention')).toHaveValue('I am becoming ');
    await page.getByLabel('Your intention').fill('x'.repeat(200));
    await expect(page.getByLabel('Your intention')).toHaveValue('x'.repeat(120));
    await page.getByLabel('Your intention').fill('More of this, please: slow mornings');
    await expect(page.locator('.intention .counter')).toHaveText('35 / 120');
    await saveScreenshots(page, testInfo, 'ritual-intention');
    await page.getByRole('button', { name: 'Fold my lantern' }).click();

    await page.waitForSelector('#ui[data-state="light"]');
    await expect(page.locator('#ui .wish')).toHaveText('More of this, please: slow mornings');
    await expect(page.locator('#ui .hint')).toHaveText('Hold to light your lantern');
    await page.getByRole('button', { name: 'Light it' }).click();
    await page.waitForFunction(() => window.__lantern!.hold().state === 'lit');
    await page.getByRole('button', { name: 'Let it rise' }).click();
    await page.waitForSelector('#ui[data-state="watch"]');
    await expect(page.locator('#ui .hint')).toHaveText('There it goes.');
    await expect(page.locator('#ui .hint')).toHaveText('Your light is on its way.', { timeout: 4000 });
    await expect(page.locator('#ui .wish')).toHaveClass(/rising/);

    // Stored at release: text, 30-day return, a sky point, rising.
    const stored = (await readIdb(page, 'lanterns')) as StoredLantern[];
    expect(stored).toHaveLength(1);
    expect(stored[0]?.text).toBe('More of this, please: slow mornings');
    expect(stored[0]?.status).toBe('rising');
    expect(Date.parse(stored[0]!.returnAt) - Date.parse(stored[0]!.createdAt)).toBe(30 * 86_400_000);
    expect(stored[0]?.sky.y).toBeGreaterThan(0);
    expect(stored[0]?.sky.y).toBeLessThan(1);

    // The buttons wait for the lantern to pass half of the sky.
    await page.evaluate(() => window.__lantern!.speed(8));
    await expect(page.getByRole('button', { name: 'Light another' })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('button', { name: 'Goodnight' })).toBeVisible();
    await expect(page.locator('#ui .hint')).toHaveText('Stay as long as you like.');
    await page.evaluate(() => window.__lantern!.speed(1));
    await saveScreenshots(page, testInfo, 'ritual-watch');

    await page.getByRole('button', { name: 'Goodnight' }).click();
    await page.waitForSelector('#ui[data-state="goodnight"]');
    await expect(page.locator('.goodnight-line')).toHaveText('Sleep well. Your lanterns will keep glowing.');
    await page.waitForTimeout(2200);
    await saveScreenshots(page, testInfo, 'ritual-goodnight');
    await page.locator('.veil').click();
    await page.waitForSelector('#ui[data-state="arrive"]');
    await expect(page.locator('.arrive .line')).toHaveText('Welcome back. Your lanterns are still glowing.');
  });

  test('let-go flow: full-moon banner, let-go copy, and nothing is written to IndexedDB', async ({ page }, testInfo) => {
    await openRitual(page, FULL);
    await expect(page.locator('.arrive .banner')).toHaveText('A full moon tonight. A gentle time to let something go.');
    await page.getByRole('button', { name: 'Begin' }).click();
    await page.waitForSelector('#ui[data-state="intention"]');
    await expect(page.getByRole('button', { name: 'Let something go' })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.intention .heading')).toHaveText('What would you like to set down tonight?');
    await expect(page.locator('.intention .helper, .intention .line.muted').first()).toHaveText("This stays between you and the night. It won't be saved.");
    await expect(page.locator('.intention .chip')).toHaveCount(4);
    const secret = 'I no longer need to carry the worry about the interview';
    await page.getByLabel('Your intention').fill(secret);
    await saveScreenshots(page, testInfo, 'ritual-let-go');
    await page.getByRole('button', { name: 'Fold my lantern' }).click();
    await page.waitForSelector('#ui[data-state="light"]');
    await page.getByRole('button', { name: 'Light it' }).click();
    await page.waitForFunction(() => window.__lantern!.hold().state === 'lit');
    await page.getByRole('button', { name: 'Let it rise' }).click();
    await page.waitForSelector('#ui[data-state="watch"]');
    await expect(page.locator('#ui .hint')).toHaveText('Lighter already.', { timeout: 4000 });

    // The lantern still rises and settles in tonight's sky.
    await page.evaluate(() => window.__lantern!.speed(8));
    await page.waitForFunction(() => window.__lantern!.skyLights() === 1, undefined, { timeout: 20_000 });
    await page.getByRole('button', { name: 'Goodnight' }).click();
    await expect(page.locator('.goodnight-line')).toHaveText("Rest easy. You've made some room tonight.");

    // Nothing stored: no lanterns key at all, and the text appears nowhere in the database.
    expect(await readIdb(page, 'lanterns')).toBeUndefined();
    const settings = await readIdb(page, 'settings');
    expect(JSON.stringify(settings)).not.toContain('interview');
    expect(await page.evaluate(() => window.__lantern!.store.lanterns().length)).toBe(0);
    // Not even in the DOM once folded.
    expect(await page.locator('#ui').innerHTML()).not.toContain('interview');
  });

  test('return flow with a mocked clock: the oldest due lantern visits first', async ({ page }, testInfo) => {
    const now = new Date('2024-09-10T21:00:00Z');
    const old = lanternAt(45, now, { id: 'old', text: 'I am welcoming a calmer autumn' });
    const older = lanternAt(70, now, { id: 'older', text: 'I trust that the move will go well' });
    const fresh = lanternAt(3, now, { id: 'fresh', text: 'More of this, please: long walks' });
    await seedLanterns(page, QUIET, [old, older, fresh]);
    expect(await page.evaluate(() => window.__lantern!.skyLights())).toBe(3);
    await expect(page.locator('.arrive .line')).toHaveText('Welcome back. Your lanterns are still glowing.');

    await page.getByRole('button', { name: 'Begin' }).click();
    await page.waitForSelector('#ui[data-state="return"]');
    const expectedDate = await page.evaluate((iso) => new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' }), older.createdAt);
    await expect(page.locator('.return .heading')).toHaveText(`A lantern from ${expectedDate} has drifted back to visit.`);
    await expect(page.locator('.return .quote')).toHaveText(older.text);
    await expect(page.locator('.return .line')).toHaveText('How is this one?');
    await page.waitForTimeout(700);
    await saveScreenshots(page, testInfo, 'ritual-return');

    await page.getByRole('button', { name: 'It came true' }).click();
    await expect(page.locator('.return .line')).toHaveText("How wonderful. It'll shine a little brighter now.");
    const stored = (await readIdb(page, 'lanterns')) as StoredLantern[];
    expect(stored.find((l) => l.id === 'older')?.status).toBe('came-true');
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.waitForSelector('#ui[data-state="intention"]');

    // One return per session: the next due lantern waits for the next Begin.
    await page.reload();
    await page.waitForSelector('#ui[data-state="arrive"]');
    await page.getByRole('button', { name: 'Begin' }).click();
    await page.waitForSelector('#ui[data-state="return"]');
    await expect(page.locator('.return .quote')).toHaveText(old.text);
    await page.getByRole('button', { name: "It's still growing" }).click();
    await expect(page.locator('.return .line')).toHaveText('Good things take their time. Back to the sky it goes.');
    const after = (await readIdb(page, 'lanterns')) as StoredLantern[];
    const grown = after.find((l) => l.id === 'old')!;
    expect(grown.status).toBe('rising');
    expect(Date.parse(grown.returnAt)).toBe(now.getTime() + 30 * 86_400_000);

    // Nothing else is due now.
    await page.reload();
    await page.waitForSelector('#ui[data-state="arrive"]');
    await page.getByRole('button', { name: 'Begin' }).click();
    await page.waitForSelector('#ui[data-state="intention"]');
  });

  test("'I've let it go' dims the light and keeps it", async ({ page }) => {
    const now = new Date('2024-09-10T21:00:00Z');
    await seedLanterns(page, QUIET, [lanternAt(40, now, { id: 'gone', text: 'I am ready for a new job' })]);
    await page.getByRole('button', { name: 'Begin' }).click();
    await page.waitForSelector('#ui[data-state="return"]');
    await page.getByRole('button', { name: "I've let it go" }).click();
    await expect(page.locator('.return .line')).toHaveText("That's okay. It'll float on, lighter.");
    const stored = (await readIdb(page, 'lanterns')) as StoredLantern[];
    expect(stored).toHaveLength(1);
    expect(stored[0]?.status).toBe('let-go');
    expect(await page.evaluate(() => window.__lantern!.skyLights())).toBe(1);
  });
});
