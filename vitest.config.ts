import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
  },
  resolve: {
    alias: {
      '@utils': resolve(__dirname, './src/utils'),
      '@components': resolve(__dirname, './src/components'),
    },
  },
});