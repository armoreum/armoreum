import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  outputDir: './test-results',
  timeout: 90_000,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:24131',
    viewport: { width: 390, height: 844 },
  },
  webServer: {
    command: 'PORT=24131 BASE_PATH=/ npm run serve -- --port 24131',
    url: 'http://127.0.0.1:24131',
    reuseExistingServer: false,
    timeout: 30_000,
  },
});
