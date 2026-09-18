import { expect, test, type Page } from '@playwright/test';
import { openScene, saveScreenshots } from './helpers';

const QUIET = 'date=2026-09-17&lanterns=2&sky=120';

function quality(page: Page) {
  return page.evaluate(() => window.__lantern!.quality());
}

test.describe('adaptive quality (SPEC section 8)', () => {
  test('level 3 (full): every light-layer effect is on', async ({ page }, testInfo) => {
    await openScene(page, `${QUIET}&quality=3`);
    const q = await quality(page);
    expect(q.level).toBe(3);
    expect(q.name).toBe('full');
    expect(q.skyHalos).toBe(true);
    expect(q.fireflies.halos).toBe(true);
    expect(q.cozy).toEqual({ wisps: true, windowGlows: true });
    expect(q.moonHalo).toBe(true);
    expect(q.lanternBloom).toEqual([true, true]);
    await saveScreenshots(page, testInfo, 'quality-3-full');
  });

  test('level 2 (fewer particles): sky halos, firefly halos and mist go; bloom stays', async ({ page }, testInfo) => {
    await openScene(page, `${QUIET}&quality=2`);
    const q = await quality(page);
    expect(q.level).toBe(2);
    expect(q.name).toBe('fewer particles');
    expect(q.skyHalos).toBe(false);
    expect(q.fireflies.halos).toBe(false);
    expect(q.fireflies.count).toBeLessThanOrEqual(7);
    expect(q.cozy).toEqual({ wisps: false, windowGlows: true });
    expect(q.moonHalo).toBe(true);
    expect(q.lanternBloom).toEqual([true, true]);
    // Past lanterns stay legible without their halos: the warm 4×4 dots are still in the pixel world.
    const warm = await page.evaluate(() => {
      const L = window.__lantern!.layout;
      return window.__lantern!.sampleRect(0, 0, L.width, L.horizon).filter((c) => c === 0xffc56b).length;
    });
    expect(warm).toBeGreaterThan(120 * 8);
    await saveScreenshots(page, testInfo, 'quality-2-fewer-particles');
  });

  test('level 1 (no bloom): lantern core and streak, moon halo and window glows go too', async ({ page }, testInfo) => {
    await openScene(page, `${QUIET}&quality=1`);
    const q = await quality(page);
    expect(q.level).toBe(1);
    expect(q.name).toBe('no bloom');
    expect(q.skyHalos).toBe(false);
    expect(q.fireflies.halos).toBe(false);
    expect(q.cozy).toEqual({ wisps: false, windowGlows: false });
    expect(q.moonHalo).toBe(false);
    expect(q.lanternBloom).toEqual([false, false]);
    await saveScreenshots(page, testInfo, 'quality-1-no-bloom');
  });

  test('a level set at runtime reaches every subsystem, and new lanterns follow it', async ({ page }) => {
    await openScene(page, `${QUIET}&quality=3`);
    await page.evaluate(() => window.__lantern!.setQuality(1));
    await page.waitForTimeout(100);
    let q = await quality(page);
    expect(q.level).toBe(1);
    expect(q.lanternBloom).toEqual([false, false]);
    expect(q.moonHalo).toBe(false);
    await page.evaluate(() => window.__lantern!.scene.lanternsOf('sky').spawnRising(0.3));
    await page.waitForTimeout(100);
    q = await quality(page);
    expect(q.lanternBloom).toEqual([false, false, false]);
    await page.evaluate(() => window.__lantern!.setQuality(3));
    await page.waitForTimeout(100);
    q = await quality(page);
    expect(q.lanternBloom).toEqual([true, true, true]);
    expect(q.skyHalos).toBe(true);
  });

  test('the governor runs when nothing pins it', async ({ page }) => {
    // quality=auto is not a level, so the helper leaves it and the governor is live.
    await openScene(page, 'date=2026-09-17&lanterns=12&sky=1000&quality=auto');
    await page.waitForTimeout(5500);
    const q = await quality(page);
    const s = await page.evaluate(() => window.__lantern!.stats());
    console.log(`governor (${test.info().project.name}): level ${q.level} (${q.name}) after 5.5 s at ${s.fps.toFixed(1)} fps, frame ${s.avgMs.toFixed(1)} ms`);
    expect([1, 2, 3]).toContain(q.level);
    // Whatever it chose, the scene agrees with it.
    expect(q.skyHalos).toBe(q.level >= 3);
    expect(q.moonHalo).toBe(q.level >= 2);
  });
});
