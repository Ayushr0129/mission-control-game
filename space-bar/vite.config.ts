import { defineConfig } from 'vitest/config';
export default defineConfig({ base: './', build: { chunkSizeWarningLimit: 900 }, test: { include: ['tests/**/*.test.ts'], testTimeout: 10_000 } });
