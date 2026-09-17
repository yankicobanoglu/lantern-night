import { defineConfig, devices } from '@playwright/test';
import { BASE } from './src/config';

const PORT = 4173;
const baseURL = `http://localhost:${PORT}${BASE}`;

const phone = { width: 390, height: 844 };
const desktop = { width: 1280, height: 800 };

export default defineConfig({
  testDir: 'e2e',
  outputDir: 'test-results',
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL,
    trace: 'retain-on-failure',
  },
  webServer: {
    command: `npm run build && npx vite preview --port ${PORT} --strictPort`,
    url: baseURL,
    reuseExistingServer: !process.env['CI'],
    timeout: 120_000,
  },
  projects: [
    {
      name: 'chromium-phone',
      use: { ...devices['Desktop Chrome'], viewport: phone, deviceScaleFactor: 3, hasTouch: true, isMobile: true },
    },
    {
      name: 'chromium-desktop',
      use: { ...devices['Desktop Chrome'], viewport: desktop, deviceScaleFactor: 2 },
    },
    {
      name: 'webkit-phone',
      use: { ...devices['Desktop Safari'], viewport: phone, deviceScaleFactor: 3, hasTouch: true, isMobile: true },
    },
    {
      name: 'webkit-desktop',
      use: { ...devices['Desktop Safari'], viewport: desktop, deviceScaleFactor: 2 },
    },
  ],
});
