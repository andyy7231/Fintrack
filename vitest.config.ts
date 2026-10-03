import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    hookTimeout: 60000,
    testTimeout: 10000,
    // Setup file to initialize test environment BEFORE any test imports
    setupFiles: ['__tests__/e2e/setup-env.ts'],
    // Run E2E tests sequentially to avoid database conflicts
    fileParallelism: false,
    maxConcurrency: 1,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
});
