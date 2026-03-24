import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@gantt/gantt-core': resolve(__dirname, 'packages/gantt-core/src/index.ts'),
      '@gantt/gantt-plugin-sdk': resolve(__dirname, 'packages/gantt-plugin-sdk/src/index.ts'),
    },
  },
  test: {
    environment: 'node',
    globals: true,
    include: ['tests/**/*.test.ts', 'packages/**/tests/**/*.test.ts', 'apps/**/tests/**/*.test.ts'],
  },
});
