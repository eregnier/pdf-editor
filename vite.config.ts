import { defineConfig } from 'vitest/config';

/**
 * Build setup: vite bundles the TS sources and, above all, resolves the pdf.js
 * worker as a separate asset (`?url` import). That worker is what keeps PDF
 * parsing off the main thread — the reason opening a file used to freeze the
 * whole browser.
 */
export default defineConfig({
  build: { outDir: 'dist', target: 'es2022', sourcemap: true },
  test: { include: ['tests/**/*.test.ts'] },
});
