import base from './playwright.config';
import { defineConfig } from '@playwright/test';
export default defineConfig({
  ...base,
  projects: [{ name: 'chromium', use: { ...base.projects![0]!.use, launchOptions: { executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] } } }],
});
