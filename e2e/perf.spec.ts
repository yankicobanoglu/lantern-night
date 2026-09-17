import { expect, test } from '@playwright/test';
import { openScene } from './helpers';

test.describe('performance smoke', () => {
  test.skip(() => !test.info().project.name.endsWith('-desktop'), 'desktop viewports only');

  test('holds a steady frame rate with low CPU time per frame', async ({ page }) => {
    await openScene(page, 'date=2026-09-17');
    await page.evaluate(() => window.__lantern!.resetStats());
    await page.waitForTimeout(3000);
    const s = await page.evaluate(() => window.__lantern!.stats());
    console.log(`perf: ${s.fps.toFixed(1)} fps, frame ${s.avgMs.toFixed(2)} ms, cpu ${s.cpuAvgMs.toFixed(3)} ms (p95 ${s.cpuP95Ms.toFixed(3)})`);
    // Headless Chromium renders on a software GPU, so only the CPU budget is asserted here.
    // The 60 fps acceptance number comes from a headed run (see PLAN-M1.md step 9).
    expect(s.frames).toBeGreaterThan(60);
    expect(s.cpuAvgMs).toBeLessThan(4);
    expect(s.cpuP95Ms).toBeLessThan(8);
  });
});
