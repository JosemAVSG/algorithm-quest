import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // Several suites validate the whole content corpus (37 missions, 41 variants),
    // which takes longer than vitest's 10 s default on a slow machine.
    hookTimeout: 60_000,
    testTimeout: 30_000,
    coverage: { provider: 'v8', include: ['src/domain/**'] },
  },
});
