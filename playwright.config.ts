import { defineConfig, devices } from '@playwright/test';

/**
 * E2E is deliberately small (docs/10-testing-and-security.md §5). Chromium only:
 * it is the launch browser (assumption A5), and a cross-browser matrix before the
 * flow is stable would be maintenance without information.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  timeout: 30_000,
  expect: { timeout: 5_000 },
  reporter: process.env.CI === undefined ? 'list' : 'github',
  use: {
    baseURL: 'http://127.0.0.1:5173',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 5173 --strictPort',
    url: 'http://127.0.0.1:5173',
    reuseExistingServer: process.env.CI === undefined,
    timeout: 60_000,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
