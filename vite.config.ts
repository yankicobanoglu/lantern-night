import { defineConfig } from 'vitest/config';
import { BASE } from './src/config';

export default defineConfig({
  base: BASE,
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
