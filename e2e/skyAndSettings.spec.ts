import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { lanternAt, openRitual, readIdb, saveScreenshots, seedLanterns, type StoredLantern } from './helpers';

const QUIET = 'date=2024-09-10';
const now = new Date('2024-09-10T21:00:00Z');

async function openMenu(page: import('@playwright/test').Page, item: 'Your sky' | 'Settings'): Promise<void> {
  await page.getByRole('button', { name: 'Menu' }).click();
  await page.getByRole('menuitem', { name: item }).click();
}

test.describe('Your sky', () => {
  test('lists every stored light; tapping one shows its date and wish', async ({ page }, testInfo) => {
    const ls = [lanternAt(2, now, { id: 'a', text: 'I am welcoming calm' }), lanternAt(9, now, { id: 'b', text: 'I trust that it works out' }), lanternAt(20, now, { id: 'c' })];
    await seedLanterns(page, QUIET, ls);
    await openMenu(page, 'Your sky');
    await expect(page.locator('.sky h2')).toHaveText('Your sky');
    await expect(page.locator('.sky .count, .sky .top .line').first()).toHaveText('3 lanterns lit');
    await expect(page.locator('.sky-light')).toHaveCount(3);
    // The arrive screen steps back while the overlay is open.
    await expect(page.locator('.arrive')).toBeHidden();
    await page.locator('.sky-light[data-id="b"]').click();
    const date = await page.evaluate((iso) => new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' }), ls[1]!.createdAt);
    await expect(page.locator('.sky-card .date')).toHaveText(date);
    await expect(page.locator('.sky-card .quote')).toHaveText('I trust that it works out');
    await saveScreenshots(page, testInfo, 'sky-view');
    await page.getByRole('button', { name: 'Close' }).click();
    await expect(page.locator('.sky')).toBeHidden();
    await expect(page.locator('.arrive')).toBeVisible();
  });

  test('is waiting when empty', async ({ page }) => {
    await openRitual(page, QUIET);
    await openMenu(page, 'Your sky');
    await expect(page.locator('.sky .top .line').first()).toHaveText('0 lanterns lit');
    await expect(page.locator('.sky .bottom .line')).toHaveText('Your sky is waiting for its first light.');
  });
});

test.describe('Settings', () => {
  test('stores sound and text size, and gentle motion is on with no way to turn it off', async ({ page }, testInfo) => {
    await openRitual(page, QUIET);
    await openMenu(page, 'Settings');
    await saveScreenshots(page, testInfo, 'settings');
    // M7: the motion row and the scene row are gone. Two settings are left.
    await expect(page.getByRole('switch', { name: 'Gentle motion' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Sky lanterns' })).toHaveCount(0);
    expect(await page.evaluate(() => document.getElementById('ui')!.classList.contains('gentle'))).toBe(true);
    await page.getByRole('switch', { name: 'Sound' }).click();
    await page.getByRole('button', { name: 'Text size largest' }).click();
    await expect.poll(() => readIdb(page, 'settings')).toMatchObject({ sound: false, textScale: 1.3 });
    const rootPx = (): Promise<number> => page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).fontSize));
    expect(await rootPx()).toBeCloseTo(20.8, 3);
    // Survives a reload, and motion is still gentle.
    await openRitual(page, QUIET);
    expect(await rootPx()).toBeCloseTo(20.8, 3);
    expect(await page.evaluate(() => document.getElementById('ui')!.classList.contains('gentle'))).toBe(true);
    await openMenu(page, 'Settings');
    await expect(page.getByRole('switch', { name: 'Sound' })).toHaveAttribute('aria-checked', 'false');
  });

  test('clear my sky asks first, then removes every lantern', async ({ page }) => {
    await seedLanterns(page, QUIET, [lanternAt(2, now), lanternAt(5, now)]);
    await openMenu(page, 'Settings');
    await page.getByRole('button', { name: 'Clear my sky' }).click();
    await expect(page.locator('.confirm')).toBeVisible();
    await expect(page.locator('.confirm .line')).toHaveText("This removes every lantern from this device. It can't be undone.");
    await page.getByRole('button', { name: 'Keep them' }).click();
    await expect(page.locator('.confirm')).toBeHidden();
    expect(await page.evaluate(() => window.__lantern!.store.lanterns().length)).toBe(2);
    await page.getByRole('button', { name: 'Clear my sky' }).first().click();
    await page.locator('.confirm').getByRole('button', { name: 'Clear my sky' }).click();
    await expect.poll(() => page.evaluate(() => window.__lantern!.store.lanterns().length)).toBe(0);
    expect(await page.evaluate(() => window.__lantern!.skyLights())).toBe(0);
    expect(await readIdb(page, 'lanterns')).toBeUndefined();
  });

  test('backup round trip: save, clear, restore, same sky', async ({ page }) => {
    // Headless WebKit offers the Web Share API but has no share sheet to show; take the download path like a browser without it.
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'canShare', { value: undefined, configurable: true });
      Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
    });
    const ls = [lanternAt(2, now, { id: 'a', text: 'I am welcoming calm' }), lanternAt(9, now, { id: 'b', text: 'I trust that it works out' })];
    await seedLanterns(page, QUIET, ls);
    await openMenu(page, 'Settings');
    const [download] = await Promise.all([page.waitForEvent('download', { timeout: 10_000 }), page.getByRole('button', { name: 'Save a backup' }).click()]);
    expect(download.suggestedFilename()).toBe('lantern-night-2024-09-10.lantern.json');
    const path = await download.path();
    const file = JSON.parse(readFileSync(path!, 'utf8')) as { app: string; version: number; lanterns: StoredLantern[] };
    expect(file.app).toBe('lantern-night');
    expect(file.version).toBe(1);
    expect(file.lanterns.map((l) => l.id).sort()).toEqual(['a', 'b']);
    await expect(page.locator('.toast')).toHaveText('Backup saved.');
    await expect.poll(() => readIdb(page, 'settings')).toMatchObject({ lastBackupAt: expect.any(String) });

    await page.getByRole('button', { name: 'Clear my sky' }).first().click();
    await page.locator('.confirm').getByRole('button', { name: 'Clear my sky' }).click();
    await expect.poll(() => page.evaluate(() => window.__lantern!.store.lanterns().length)).toBe(0);

    await page.locator('.settings input[type="file"]').setInputFiles(path!);
    await expect(page.locator('.toast')).toHaveText('Your sky is back. 2 lanterns restored');
    const restored = (await readIdb(page, 'lanterns')) as StoredLantern[];
    expect(restored.map((l) => l.id).sort()).toEqual(['a', 'b']);
    expect(restored.find((l) => l.id === 'a')?.text).toBe('I am welcoming calm');
    expect(await page.evaluate(() => window.__lantern!.skyLights())).toBe(2);

    // Restoring again merges by id: nothing doubles, the existing entry wins.
    await page.locator('.settings input[type="file"]').setInputFiles(path!);
    await expect(page.locator('.toast')).toHaveText('Your sky is back. 0 lanterns restored');
    expect(((await readIdb(page, 'lanterns')) as StoredLantern[]).length).toBe(2);
  });

  test('restoring a file that is not ours shows the error and changes nothing', async ({ page }) => {
    await seedLanterns(page, QUIET, [lanternAt(2, now, { id: 'a' })]);
    await openMenu(page, 'Settings');
    await page.locator('.settings input[type="file"]').setInputFiles({ name: 'notes.json', mimeType: 'application/json', buffer: Buffer.from('{"hello":"world"}') });
    await expect(page.locator('.toast')).toHaveText("That file isn't a Lantern Night backup. Choose a file that ends in .lantern.json.");
    expect(((await readIdb(page, 'lanterns')) as StoredLantern[]).length).toBe(1);
  });
});
