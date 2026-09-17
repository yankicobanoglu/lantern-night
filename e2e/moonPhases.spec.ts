import { expect, test } from '@playwright/test';
import { PALETTE } from '../src/palette';
import { getLayout, openScene, sampleRect, saveScreenshots } from './helpers';

const DISC_MIN = 700; // π·15.5² ≈ 755 art px

test.describe('moon phases', () => {
  test.skip(() => !test.info().project.name.endsWith('-phone'), 'phone viewport only');

  for (let frame = 0; frame < 8; frame++) {
    test(`frame ${frame} is readable and the whole disc is visible`, async ({ page }, testInfo) => {
      await openScene(page, `phase=${frame}`);
      expect(await page.evaluate(() => window.__lantern!.moonFrame())).toBe(frame);
      const l = await getLayout(page);
      const px = await sampleRect(page, l.moon.x - 16, l.moon.y - 16, 32, 32);
      const lit = px.filter((c) => c === PALETTE.moon).length;
      const dark = px.filter((c) => c === PALETTE.earthshine).length;
      expect(lit + dark).toBeGreaterThanOrEqual(DISC_MIN);
      if (frame === 0) expect(lit).toBe(0);
      if (frame === 4) expect(dark).toBe(0);
      if (frame === 1 || frame === 7) {
        const row = px.slice(16 * 32, 17 * 32);
        expect(row.filter((c) => c === PALETTE.moon).length).toBeGreaterThanOrEqual(4);
      }
      // The moon is at least 24 screen px (it is 32 art px).
      expect(32 * l.cssScale).toBeGreaterThanOrEqual(24);
      await saveScreenshots(page, testInfo, `moon-${frame}`);
    });
  }
});
