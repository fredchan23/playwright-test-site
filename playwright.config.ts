import { defineConfig, devices } from '@playwright/test';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:5173';
// this line is for debugging purposes only, to ensure the correct base URL is being used in the tests
console.log(`Using base URL: ${BASE_URL}`);
export default defineConfig({
  globalSetup: './e2e/fixtures/global-setup.ts',
  testDir: './e2e/specs',

  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [['html', { open: 'never' }], ['list']] : [['html', { open: 'never' }], ['list']],

  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: process.env.RECORD_VIDEO ? 'on' : 'off',
  },

  projects: [
    {
      name: 'setup',
      testDir: './e2e/fixtures',
      testMatch: /auth\.setup\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'e2e/.auth/regular-user.json',
      },
      dependencies: ['setup'],
      testIgnore: [/admin-settings\.spec\.ts$/, /edge-function-metadata\.spec\.ts$/, /edge-function-qa-cache\.spec\.ts$/],
    },
    {
      name: 'chromium-admin',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'e2e/.auth/admin-user.json',
      },
      dependencies: ['setup'],
      testMatch: /admin-settings\.spec\.ts/,
    },
    {
      // API-only tests: no browser, no local dev server, no auth setup dependency.
      name: 'api',
      testMatch: /edge-function-(metadata|qa-cache)\.spec\.ts/,
    },
  ],
});
