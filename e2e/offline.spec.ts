import { expect, test } from '@playwright/test';
import { openRitual } from './helpers';

const BASE_PATH = '/lantern-night/';

test.describe('offline and install', () => {
  test('the manifest and icons are served under the base path', async ({ page, baseURL }) => {
    await openRitual(page, 'date=2024-09-10');
    const manifest = await page.request.get(`${baseURL}manifest.webmanifest`);
    expect(manifest.ok()).toBe(true);
    const m = (await manifest.json()) as { start_url: string; scope: string; display: string; icons: { src: string }[] };
    expect(m.start_url).toBe(BASE_PATH);
    expect(m.scope).toBe(BASE_PATH);
    expect(m.display).toBe('standalone');
    for (const icon of m.icons) {
      const r = await page.request.get(`${baseURL}${icon.src}`);
      expect(r.ok(), icon.src).toBe(true);
      expect(r.headers()['content-type']).toContain('image/png');
    }
    // Apple tags for the home screen.
    await expect(page.locator('meta[name="apple-mobile-web-app-capable"]')).toHaveAttribute('content', 'yes');
    const touchIcon = await page.locator('link[rel="apple-touch-icon"]').getAttribute('href');
    expect(touchIcon).toContain(`${BASE_PATH}icons/apple-touch-icon.png`);
    const r = await page.request.get(`${baseURL}icons/apple-touch-icon.png`);
    expect(r.ok()).toBe(true);
  });

  /** The service worker precaches every file during install; once it is active the site is cached. */
  async function waitForWorker(page: import('@playwright/test').Page): Promise<void> {
    await page.waitForFunction(
      async () => {
        const reg = await navigator.serviceWorker?.getRegistration();
        return !!reg?.active && navigator.serviceWorker.controller !== null;
      },
      undefined,
      { timeout: 30_000 },
    );
  }

  test('the service worker caches every file the page loaded', async ({ page }) => {
    await openRitual(page, 'date=2024-09-10');
    await waitForWorker(page);
    // The page, its scripts, styles and fonts (the worker script itself is kept by the browser, not the cache).
    const cached = await page.evaluate(async () => {
      const keys = await caches.keys();
      const urls = new Set<string>();
      for (const k of keys) for (const req of await (await caches.open(k)).keys()) urls.add(new URL(req.url).pathname);
      const loaded = performance
        .getEntriesByType('resource')
        .map((e) => new URL(e.name).pathname)
        .filter((p) => /\.(js|css|woff2?|png)$/.test(p) && !p.includes('workbox') && !p.endsWith('/sw.js'));
      return { index: urls.has('/lantern-night/index.html'), missing: loaded.filter((p) => !urls.has(p)), count: urls.size };
    });
    expect(cached.index).toBe(true);
    expect(cached.missing).toEqual([]);
    expect(cached.count).toBeGreaterThan(10);
  });

  test('works offline after the first load', async ({ page, context, browserName }) => {
    // Playwright's WebKit cannot reload a worker-controlled page while offline (internal error); the
    // real offline reload is checked in Chromium here and on the iPhone in airplane mode (M5 checklist).
    test.skip(browserName === 'webkit', 'offline reload is not supported by Playwright WebKit');
    await openRitual(page, 'date=2024-09-10');
    await waitForWorker(page);
    await context.setOffline(true);
    await page.reload();
    await page.waitForSelector('body[data-ready="true"]', { timeout: 30_000 });
    await page.waitForSelector('#ui[data-state="arrive"]');
    await expect(page.locator('.arrive .line')).toHaveText('Welcome. The evening is quiet tonight.');
    // The fonts came from the cache too.
    const fontsOk = await page.evaluate(async () => {
      await document.fonts.ready;
      return document.fonts.check('16px "Nunito"') && document.fonts.check('16px "Pixelify Sans"');
    });
    expect(fontsOk).toBe(true);
    // Nothing but our own files were ever requested.
    await context.setOffline(false);
  });

  test('only the site’s own files are requested', async ({ page, baseURL }) => {
    const origin = new URL(baseURL!).origin;
    const foreign: string[] = [];
    page.on('request', (r) => {
      if (!r.url().startsWith(origin) && !r.url().startsWith('data:') && !r.url().startsWith('blob:')) foreign.push(r.url());
    });
    await openRitual(page, 'date=2024-09-10');
    await page.getByRole('button', { name: 'Begin' }).click();
    await page.waitForSelector('#ui[data-state="intention"]');
    await page.waitForTimeout(500);
    expect(foreign).toEqual([]);
  });
});
