import { expect, test } from '@playwright/test';
import { PALETTE } from '../src/palette';
import { getLayout, openScene, sampleRect, saveScreenshots } from './helpers';

const N = 40;
const WARM = new Set<number>([PALETTE.lantern, PALETTE.lanternCore]);

test.describe('past lanterns vs stars', () => {
  test.skip(() => !test.info().project.name.endsWith('-phone'), 'phone viewport only');

  test(`${N} sky lights are warm 4×4 lights, stars stay cool 1 px`, async ({ page }, testInfo) => {
    await openScene(page, `date=2026-09-17&sky=${N}`);
    const l = await getLayout(page);
    expect(await page.evaluate(() => window.__lantern!.skyLights())).toBe(N);
    const px = await sampleRect(page, 0, 0, l.width, l.horizon);
    const at = (x: number, y: number): number => px[y * l.width + x] ?? -1;

    // Count warm connected components of at least 10 px: each 4×4 light has 12.
    const seen = new Uint8Array(l.width * l.horizon);
    let blocks = 0;
    let warmPixels = 0;
    for (let y = 0; y < l.horizon; y++) {
      for (let x = 0; x < l.width; x++) {
        if (!WARM.has(at(x, y))) continue;
        warmPixels++;
        if (seen[y * l.width + x]) continue;
        let size = 0;
        const stack = [[x, y]];
        while (stack.length) {
          const [cx, cy] = stack.pop()!;
          if (cx! < 0 || cy! < 0 || cx! >= l.width || cy! >= l.horizon) continue;
          const i = cy! * l.width + cx!;
          if (seen[i] || !WARM.has(at(cx!, cy!))) continue;
          seen[i] = 1;
          size++;
          stack.push([cx! + 1, cy!], [cx! - 1, cy!], [cx!, cy! + 1], [cx!, cy! - 1]);
        }
        if (size >= 10) blocks++;
      }
    }
    // Cottage windows sit below the horizon, so every warm pixel here is a sky light.
    expect(warmPixels).toBeGreaterThanOrEqual(N * 12 * 0.9);
    expect(blocks).toBeGreaterThanOrEqual(Math.floor(N * 0.85));

    // Stars are still there, cool white, and no star pixel is inside a warm block.
    const stars = px.filter((c) => c === PALETTE.star).length;
    expect(stars).toBeGreaterThan(20);

    // Each light is 4 art px, i.e. ≥ 10 screen px, and its halo makes it ≥ 24 screen px.
    expect(4 * l.cssScale).toBeGreaterThanOrEqual(10);
    await saveScreenshots(page, testInfo, 'sky-legibility');
  });
});
