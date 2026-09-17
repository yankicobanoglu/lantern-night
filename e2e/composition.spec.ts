import { expect, test } from '@playwright/test';
import { PALETTE, SKY_BANDS } from '../src/palette';
import { getLayout, openScene, samplePixel, sampleRect, saveScreenshots } from './helpers';

const SKY_COLOURS = new Set<number>(SKY_BANDS.map((k) => PALETTE[k]));

test('scene composition matches SPEC section 7', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });

  await openScene(page, 'date=2026-09-17');
  const l = await getLayout(page);

  // Integer device-pixel scale, world fills the viewport.
  expect(Number.isInteger(l.scale)).toBe(true);
  const vp = page.viewportSize()!;
  expect(l.width * l.cssScale).toBeGreaterThanOrEqual(vp.width);
  expect(l.height * l.cssScale).toBeGreaterThanOrEqual(vp.height);

  // 55 / 15 / 20 / 10 vertical split.
  expect(l.horizon / l.height).toBeCloseTo(0.55, 1);
  expect((l.hillsEnd - l.horizon) / l.height).toBeCloseTo(0.15, 1);
  expect((l.lakeEnd - l.hillsEnd) / l.height).toBeCloseTo(0.2, 1);
  expect((l.height - l.lakeEnd) / l.height).toBeCloseTo(0.1, 1);

  // Moon upper right, dock centred.
  expect(l.moon.x / l.width).toBeGreaterThan(0.6);
  expect(l.moon.y / l.horizon).toBeLessThan(0.35);
  expect(Math.abs(l.dockX - l.width / 2)).toBeLessThanOrEqual(1);

  // Palette-exact samples: night at the top, a horizon-glow band above the far hills,
  // hills in hill colours, shore colour at the bottom edge.
  // Top-left corner is deep night (a star may sit on any single pixel, so check the majority of a patch).
  const corner = await sampleRect(page, 0, 0, 8, 8);
  expect(corner.filter((c) => c === PALETTE.night).length).toBeGreaterThan(48);
  const glow = await samplePixel(page, 3, l.horizon - 22);
  expect(SKY_COLOURS.has(glow)).toBe(true);
  expect([PALETTE.rose, PALETTE.blush, PALETTE.apricot, PALETTE.plum]).toContain(glow);
  expect([PALETTE.farHills, PALETTE.nearHills, PALETTE.shore]).toContain(await samplePixel(page, 3, l.horizon + 2));
  expect(await samplePixel(page, 3, l.height - 1)).toBe(PALETTE.shore);
  // Dock wood at the centre of the shore/lake boundary.
  expect([PALETTE.wood, PALETTE.woodDark]).toContain(await samplePixel(page, l.dockX, l.lakeEnd - 3));

  // Lit cottage windows exist on the far hills.
  // Windows flicker between three warm colours, so count all of them.
  const warm: number[] = [PALETTE.lantern, PALETTE.lanternCore, PALETTE.ember];
  const band = await sampleRect(page, 0, l.horizon - 20, l.width, 24);
  expect(band.filter((c) => warm.includes(c)).length).toBeGreaterThanOrEqual(10);

  await saveScreenshots(page, testInfo, 'composition');
  expect(errors, errors.join('\n')).toEqual([]);
});
