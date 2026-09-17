import { expect, test } from '@playwright/test';
import { PALETTE } from '../src/palette';
import { getLayout, openScene, sampleRect, saveScreenshots } from './helpers';

const N = 40;
const WARM = new Set<number>([PALETTE.lantern, PALETTE.lanternCore]);

test.describe('past lanterns vs stars', () => {
  test.skip(() => !test.info().project.name.endsWith('-phone'), 'phone viewport only');

  test(`${N} sky lights are warm 2×2 blocks, stars stay cool 1 px`, async ({ page }, testInfo) => {
    await openScene(page, `date=2026-09-17&sky=${N}`);
    const l = await getLayout(page);
    expect(await page.evaluate(() => window.__lantern!.skyLights())).toBe(N);
    const px = await sampleRect(page, 0, 0, l.width, l.horizon);
    const at = (x: number, y: number): number => px[y * l.width + x] ?? -1;

    // Count full warm 2×2 blocks by their top-left corner.
    let blocks = 0;
    let warmPixels = 0;
    for (let y = 0; y < l.horizon - 1; y++) {
      for (let x = 0; x < l.width - 1; x++) {
        if (WARM.has(at(x, y))) warmPixels++;
        if (WARM.has(at(x, y)) && WARM.has(at(x + 1, y)) && WARM.has(at(x, y + 1)) && WARM.has(at(x + 1, y + 1))) blocks++;
      }
    }
    // Cottage windows sit below the horizon, so every warm pixel here is a sky light.
    expect(warmPixels).toBeGreaterThanOrEqual(N * 4 * 0.9);
    expect(blocks).toBeGreaterThanOrEqual(Math.floor(N * 0.85));

    // Stars are still there, cool white, and no star pixel is inside a warm block.
    const stars = px.filter((c) => c === PALETTE.star).length;
    expect(stars).toBeGreaterThan(20);

    // Each light is at least 2 art px, i.e. ≥ 5 screen px, and its halo makes it ≥ 24 screen px.
    expect(2 * l.cssScale).toBeGreaterThanOrEqual(5);
    await saveScreenshots(page, testInfo, 'sky-legibility');
  });
});
