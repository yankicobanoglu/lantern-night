import { expect, test, type Page } from '@playwright/test';
import { foldLantern, openRitual, readIdb, saveScreenshots } from './helpers';

const QUIET = 'date=2024-09-10';

function focusedName(page: Page): Promise<string> {
  return page.evaluate(() => {
    const a = document.activeElement as HTMLElement | null;
    return a ? a.getAttribute('aria-label') || a.textContent?.trim() || a.tagName : '';
  });
}

/**
 * Press Tab until the focused control has this name (at most `max` presses).
 * WebKit follows Safari's default and skips buttons unless Option is held.
 */
async function tabTo(page: Page, name: string, max = 24): Promise<void> {
  const key = page.context().browser()?.browserType().name() === 'webkit' ? 'Alt+Tab' : 'Tab';
  for (let i = 0; i < max; i++) {
    if ((await focusedName(page)) === name) return;
    await page.keyboard.press(key);
  }
  expect(await focusedName(page), `could not tab to ${name}`).toBe(name);
}

/** Fold, light and release one lantern with the buttons, then wait for the watch buttons. */
async function riseOnce(page: Page, text: string): Promise<void> {
  await foldLantern(page, text);
  await page.getByRole('button', { name: 'Light it' }).click();
  await page.waitForFunction(() => window.__lantern!.hold().state === 'lit');
  await page.getByRole('button', { name: 'Let it rise' }).click();
  await page.waitForSelector('#ui[data-state="watch"]');
  await page.evaluate(() => window.__lantern!.speed(8));
  await expect(page.getByRole('button', { name: 'Goodnight' })).toBeVisible({ timeout: 15_000 });
  await page.evaluate(() => window.__lantern!.speed(1));
}

test.describe('keyboard only', () => {
  test('the whole ritual runs from the keyboard, and Escape closes what is on top', async ({ page }) => {
    await openRitual(page, QUIET);
    // Each screen puts focus on its first control.
    await expect.poll(() => focusedName(page)).toBe('Begin');
    await page.keyboard.press('Enter');
    await page.waitForSelector('#ui[data-state="intention"]');
    await expect.poll(() => focusedName(page)).toBe('Your intention');
    await page.keyboard.type('I am welcoming quiet mornings');
    await tabTo(page, 'Fold my lantern');
    await page.keyboard.press('Enter');
    await page.waitForSelector('#ui[data-state="light"]');
    await expect.poll(() => focusedName(page)).toBe('Light it');
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => window.__lantern!.hold().state === 'lit');
    await expect.poll(() => focusedName(page)).toBe('Let it rise');
    await page.keyboard.press('Enter');
    await page.waitForSelector('#ui[data-state="watch"]');
    await page.evaluate(() => window.__lantern!.speed(8));
    await expect(page.getByRole('button', { name: 'Goodnight' })).toBeVisible({ timeout: 15_000 });
    await page.evaluate(() => window.__lantern!.speed(1));
    await expect.poll(() => focusedName(page)).toBe('Light another');
    await tabTo(page, 'Goodnight');
    await page.keyboard.press('Enter');
    await page.waitForSelector('#ui[data-state="goodnight"]');
    await expect.poll(() => focusedName(page)).toBe('Back to the start');
    await page.waitForTimeout(1700);
    await page.keyboard.press('Enter');
    await page.waitForSelector('#ui[data-state="arrive"]');
    await expect.poll(() => focusedName(page)).toBe('Begin');

    // Menu → Settings from the keyboard, Escape back out.
    await tabTo(page, 'Menu');
    await page.keyboard.press('Enter');
    await expect.poll(() => focusedName(page)).toBe('Your sky');
    await tabTo(page, 'Settings');
    await page.keyboard.press('Enter');
    await expect(page.locator('.settings')).toBeVisible();
    await expect.poll(() => focusedName(page)).toBe('Sound');
    await page.keyboard.press('Escape');
    await expect(page.locator('.settings')).toBeHidden();
    await expect.poll(() => focusedName(page)).toBe('Menu');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Escape');
    await expect(page.locator('.menu-sheet')).toBeHidden();
  });
});

test.describe('reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test('the ritual completes with gentle motion and the star still appears', async ({ page }, testInfo) => {
    await openRitual(page, `${QUIET}&star=now`);
    expect(await page.evaluate(() => document.getElementById('ui')!.classList.contains('gentle'))).toBe(true);
    await page.waitForFunction(() => window.__lantern!.star() !== null, undefined, { timeout: 8000 });
    await riseOnce(page, 'I am becoming steadier');
    await saveScreenshots(page, testInfo, 'reduced-motion-watch');
    await page.waitForFunction(() => window.__lantern!.skyLights() === 1, undefined, { timeout: 30_000 });
    await page.getByRole('button', { name: 'Goodnight' }).click();
    await page.waitForSelector('#ui[data-state="goodnight"]');
    await expect(page.locator('.goodnight-line')).toHaveText('Sleep well. Your lanterns will keep glowing.');
  });
});

test.describe('sound', () => {
  test('audio starts only after the first tap; the mute toggle and the Settings switch share one setting', async ({ page }) => {
    await openRitual(page, QUIET);
    expect(await page.evaluate(() => window.__lantern!.audio())).toMatchObject({ started: false, muted: false });
    await expect(page.getByRole('button', { name: 'Sound on' })).toBeVisible();
    await page.getByRole('button', { name: 'Begin' }).click();
    const after = await page.evaluate(() => window.__lantern!.audio());
    expect(after.started).toBe(true);
    console.log(`audio after first tap: ${JSON.stringify(after)}`);
    // Mute from the corner: stored, and mirrored in Settings.
    await page.getByRole('button', { name: 'Sound on' }).click();
    await expect(page.getByRole('button', { name: 'Sound off' })).toHaveAttribute('aria-pressed', 'false');
    await expect.poll(() => readIdb(page, 'settings')).toMatchObject({ sound: false });
    expect((await page.evaluate(() => window.__lantern!.audio())).muted).toBe(true);
    await page.getByRole('button', { name: 'Menu' }).click();
    await page.getByRole('menuitem', { name: 'Settings' }).click();
    await expect(page.getByRole('switch', { name: 'Sound' })).toHaveAttribute('aria-checked', 'false');
    // The toggle stays visible over the settings sheet.
    await expect(page.getByRole('button', { name: 'Sound off' })).toBeVisible();
    await page.getByRole('switch', { name: 'Sound' }).click();
    await expect(page.getByRole('button', { name: 'Sound on' })).toHaveAttribute('aria-pressed', 'true');
    expect((await page.evaluate(() => window.__lantern!.audio())).muted).toBe(false);
  });
});

test.describe('install hint and persistent storage', () => {
  test('iOS Safari: shown after the first lantern on the first visit, again on the third, never in between', async ({ page }, testInfo) => {
    const q = `${QUIET}&install=ios`;
    await openRitual(page, q);
    expect(await page.evaluate(() => window.__lantern!.install())).toEqual({ path: 'ios', hintCount: 0 });
    await riseOnce(page, 'I am welcoming calm');
    await expect(page.locator('.install')).toBeVisible();
    await expect(page.locator('.install .line')).toHaveText('Keep Lantern Night on your home screen so your sky stays safe: tap Share, then Add to Home Screen.');
    await expect(page.locator('.install').getByRole('button', { name: 'Install' })).toBeHidden();
    await saveScreenshots(page, testInfo, 'install-hint');
    await expect.poll(() => readIdb(page, 'settings')).toMatchObject({ installHintCount: 1, sessions: 1 });
    // The first saved lantern asked the browser to keep the data.
    const settings = (await readIdb(page, 'settings')) as { persistGranted: boolean | null };
    const supported = await page.evaluate(() => typeof navigator.storage?.persist === 'function');
    if (supported) expect(typeof settings.persistGranted).toBe('boolean');
    console.log(`persist supported: ${supported}, granted: ${String(settings.persistGranted)}`);
    await page.locator('.install').getByRole('button', { name: 'Close' }).click();
    await expect(page.locator('.install')).toBeHidden();

    // Second visit: nothing.
    await openRitual(page, q);
    await riseOnce(page, 'I trust that it works out');
    await page.waitForTimeout(400);
    await expect(page.locator('.install')).toBeHidden();
    await expect.poll(() => readIdb(page, 'settings')).toMatchObject({ installHintCount: 1, sessions: 2 });

    // Third visit: once more.
    await openRitual(page, q);
    await riseOnce(page, 'More of this, please: slow evenings');
    await expect(page.locator('.install')).toBeVisible();
    await expect.poll(() => readIdb(page, 'settings')).toMatchObject({ installHintCount: 2, sessions: 3 });

    // Fourth: never again.
    await openRitual(page, q);
    await riseOnce(page, "I'd love to feel rested");
    await page.waitForTimeout(400);
    await expect(page.locator('.install')).toBeHidden();
  });

  test('other browsers: the line and an Install button', async ({ page }) => {
    await openRitual(page, `${QUIET}&install=prompt`);
    await riseOnce(page, 'I am welcoming calm');
    await expect(page.locator('.install .line')).toHaveText('Install Lantern Night so your sky stays safe.');
    await page.locator('.install').getByRole('button', { name: 'Install' }).click();
    await expect(page.locator('.install')).toBeHidden();
  });

  test('installed: no hint', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'standalone', { value: true, configurable: true });
    });
    await openRitual(page, QUIET);
    const info = await page.evaluate(() => window.__lantern!.install());
    expect(info.path).toBe('installed');
  });
});
