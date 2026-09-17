// Measure frame times per quality level in a headed Chromium (real GPU) at the phone viewport.
// Usage: npm run preview (port 4174 via .claude/launch.json, or `npx vite preview --port 4174`) then `node scripts/measure-quality.mjs`.
// Headed Chromium on this Mac's real GPU: phone viewport at DPR 3, each pinned quality level, quiet and heavy scenes.
import { chromium } from '@playwright/test';
const base = 'http://localhost:4174/lantern-night/';
const scenes = { quiet: 'date=2026-09-17', heavy: 'date=2026-09-17&lanterns=12&sky=1000' };
const browser = await chromium.launch({ headless: false, args: ['--window-size=420,900', '--window-position=40,40'] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true });
const page = await ctx.newPage();
const rows = [];
for (const [name, q] of Object.entries(scenes)) {
  for (const level of [3, 2, 1]) {
    await page.goto(`${base}?${q}&quality=${level}`);
    await page.waitForSelector('body[data-ready="true"]', { timeout: 30000 });
    await page.waitForTimeout(3000);
    await page.evaluate(() => window.__lantern.resetStats());
    await page.waitForTimeout(5000);
    const s = await page.evaluate(() => window.__lantern.stats());
    const gl = await page.evaluate(() => { const c = document.getElementById('world'); const g = c.getContext('webgl2') || c.getContext('webgl'); const d = g && g.getExtension('WEBGL_debug_renderer_info'); return d ? g.getParameter(d.UNMASKED_RENDERER_WEBGL) : 'n/a'; });
    rows.push({ scene: name, level, fps: s.fps.toFixed(1), frameMs: s.avgMs.toFixed(2), p95Ms: s.p95Ms.toFixed(2), cpuMs: s.cpuAvgMs.toFixed(3), cpuP95: s.cpuP95Ms.toFixed(3), frames: s.frames, gl });
  }
}
// Governor live on the heavy scene: what does it settle on?
await page.goto(`${base}?${scenes.heavy}&quality=auto`);
await page.waitForSelector('body[data-ready="true"]', { timeout: 30000 });
await page.waitForTimeout(12000);
const auto = await page.evaluate(() => ({ q: window.__lantern.quality().level, s: window.__lantern.stats() }));
console.table(rows);
console.log('governor live, heavy scene after 12 s:', auto.q, `${auto.s.fps.toFixed(1)} fps, frame ${auto.s.avgMs.toFixed(2)} ms`);
await browser.close();
