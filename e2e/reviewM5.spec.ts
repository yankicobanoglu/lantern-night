import { expect, test, type Page } from '@playwright/test';
import { foldLantern, openRitual, saveScreenshots } from './helpers';

const isDesktop = (): boolean => test.info().project.name.endsWith('-desktop');

async function releaseNow(page: Page): Promise<void> {
  await page.evaluate(() => window.__lantern!.light());
  await page.getByRole('button', { name: 'Let it rise' }).click();
  await page.waitForSelector('#ui[data-state="watch"]');
}

test.describe('review fixes after M5', () => {
  test('the sound hint shows once after Begin, like the star hint', async ({ page }) => {
    await openRitual(page, 'date=2026-09-18');
    await page.getByRole('button', { name: 'Begin' }).click();
    await expect(page.locator('.toast')).toHaveText('Turn your sound on to hear the evening.');
    await page.reload();
    await page.waitForSelector('#ui[data-state="arrive"]');
    await page.getByRole('button', { name: 'Begin' }).click();
    await page.waitForSelector('#ui[data-state="intention"]');
    await page.waitForTimeout(300);
    await expect(page.locator('.toast')).toBeHidden();
  });

  test('a tap on the empty scene while writing goes back to the start', async ({ page }) => {
    await openRitual(page, 'date=2026-09-18');
    await page.getByRole('button', { name: 'Begin' }).click();
    await page.waitForSelector('#ui[data-state="intention"]');
    await page.locator('.toast').evaluate((n) => n.classList.remove('on'));
    // While the field has focus the first tap only puts the keyboard away.
    await page.getByLabel('Your intention').focus();
    await page.mouse.click(page.viewportSize()!.width / 2, 60);
    expect(await page.evaluate(() => window.__lantern!.state())).toBe('intention');
    await page.mouse.click(page.viewportSize()!.width / 2, 60);
    await page.waitForSelector('#ui[data-state="arrive"]');
    await expect(page.getByRole('button', { name: 'Begin' })).toBeVisible();
  });

  test('the menu closes on a tap anywhere else, and that tap does nothing more', async ({ page }) => {
    await openRitual(page, 'date=2026-09-18');
    await page.getByRole('button', { name: 'Menu' }).click();
    await expect(page.locator('.menu-sheet')).toBeVisible();
    await page.mouse.click(page.viewportSize()!.width / 2, 40);
    await expect(page.locator('.menu-sheet')).toBeHidden();
    expect(await page.evaluate(() => window.__lantern!.state())).toBe('arrive');
  });

  test('Your sky and Settings close on a tap on their backdrop', async ({ page }) => {
    await openRitual(page, 'date=2026-09-18');
    await page.getByRole('button', { name: 'Menu' }).click();
    await page.getByRole('menuitem', { name: 'Settings' }).click();
    await expect(page.locator('.settings')).toBeVisible();
    await expect(page.locator('.legal')).toContainText('Privacy: your lanterns stay on this device');
    await page.mouse.click(page.viewportSize()!.width / 2, 120);
    await expect(page.locator('.settings')).toBeHidden();
    await page.getByRole('button', { name: 'Menu' }).click();
    await page.getByRole('menuitem', { name: 'Your sky' }).click();
    await expect(page.locator('.sky')).toBeVisible();
    await page.mouse.click(page.viewportSize()!.width / 2, 200);
    await expect(page.locator('.sky')).toBeHidden();
  });

  test('a stored light still on its way keeps its ring with the rising lantern', async ({ page }) => {
    await openRitual(page, 'date=2026-09-18');
    await foldLantern(page, 'a wish on its way');
    await releaseNow(page);
    await page.waitForFunction(() => window.__lantern!.store.lanterns().length === 1);
    await page.getByRole('button', { name: 'Menu' }).click();
    await page.getByRole('menuitem', { name: 'Your sky' }).click();
    await expect(page.locator('.sky-light')).toHaveCount(1);
    const ring = page.locator('.sky-light');
    const at = async (): Promise<{ x: number; y: number }> => {
      const b = (await ring.boundingBox())!;
      return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
    };
    const lantern = async (): Promise<{ x: number; y: number }> =>
      page.evaluate(() => {
        const l = window.__lantern!.lanterns().find((x) => x.phase === 'rising')!;
        const L = window.__lantern!.layout;
        return { x: l.x * L.cssScale, y: l.y * L.cssScale };
      });
    const r1 = await at();
    const l1 = await lantern();
    expect(Math.abs(r1.x - l1.x)).toBeLessThan(6);
    expect(Math.abs(r1.y - l1.y)).toBeLessThan(6);
    await page.evaluate(() => window.__lantern!.speed(6));
    await page.waitForTimeout(1500);
    await page.evaluate(() => window.__lantern!.speed(1));
    const r2 = await at();
    expect(r2.y).toBeLessThan(r1.y - 20);
  });

  test('the title sits mid-screen, is centred with the welcome line, and leaves when tapped', async ({ page }, testInfo) => {
    await openRitual(page, 'date=2026-09-18');
    const title = page.locator('.title');
    const box = (await title.boundingBox())!;
    const vh = page.viewportSize()!.height;
    expect(box.y + box.height / 2).toBeGreaterThan(vh * 0.3);
    expect(box.y + box.height / 2).toBeLessThan(vh * 0.55);
    expect(await page.locator('.arrive .line').evaluate((n) => getComputedStyle(n).textAlign)).toBe('center');
    await saveScreenshots(page, testInfo, 'arrive-title');
    await title.click();
    await expect(title).toHaveClass(/gone/);
    await expect(title).toHaveCSS('opacity', '0', { timeout: 3000 });
  });

  test('the intention panel stays centred on wide screens with gentle motion', async ({ page }) => {
    test.skip(!isDesktop(), 'wide layout only');
    await openRitual(page, 'date=2026-09-18&motion=gentle');
    await page.getByRole('button', { name: 'Begin' }).click();
    await page.waitForSelector('#ui[data-state="intention"]');
    await page.waitForTimeout(700);
    const box = (await page.locator('.screen.intention').boundingBox())!;
    expect(Math.abs(box.x + box.width / 2 - page.viewportSize()!.width / 2)).toBeLessThan(2);
  });

  test('the share text carries the site address', async ({ page }) => {
    await openRitual(page, 'date=2026-09-18');
    await page.evaluate(() => {
      const w = window as unknown as { __shared: ShareData[] };
      w.__shared = [];
      Object.defineProperty(navigator, 'canShare', { value: () => true, configurable: true });
      Object.defineProperty(navigator, 'share', { value: (d: ShareData) => (w.__shared.push(d), Promise.resolve()), configurable: true });
    });
    await page.getByRole('button', { name: 'Menu' }).click();
    await page.getByRole('menuitem', { name: 'Your sky' }).click();
    await page.locator('.sky').getByRole('button', { name: 'Share my sky' }).click();
    await expect(page.locator('.share-preview')).toHaveAttribute('src', /^data:image\/png/, { timeout: 15_000 });
    await page.locator('.share .btn.primary').click();
    const shared = await page.evaluate(() => (window as unknown as { __shared: ShareData[] }).__shared);
    expect(shared).toHaveLength(1);
    expect(shared[0]!.text).toBe('Light a lantern. Let it rise. http://localhost:4173/lantern-night/');
    expect(shared[0]!.files).toHaveLength(1);
  });
});
