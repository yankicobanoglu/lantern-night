import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig } from 'vitest/config';
import { BASE } from './src/config';

export default defineConfig({
  base: BASE,
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: false,
      includeAssets: ['fonts/*.woff2', 'fonts/*.woff', 'icons/*.png'],
      manifest: {
        name: 'Lantern Night',
        short_name: 'Lantern Night',
        description: 'Light a lantern. Let it rise.',
        start_url: BASE,
        scope: BASE,
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#1B1B3A',
        theme_color: '#1B1B3A',
        lang: 'en',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,woff,woff2,png,webmanifest}'],
        cleanupOutdatedCaches: true,
        // Only our own static files are ever fetched; nothing else is cached at runtime.
        runtimeCaching: [],
      },
      devOptions: { enabled: false },
    }),
  ],
  build: {
    target: 'es2022',
    sourcemap: false,
  },
  server: {
    port: Number(process.env['PORT']) || 5173,
  },
  preview: {
    port: 4173,
  },
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
  },
});
