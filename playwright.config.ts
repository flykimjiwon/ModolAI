import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 1,
  workers: 4,
  reporter: [
    ['html', { outputFolder: 'tests/reports/html', open: 'never' }],
    ['json', { outputFile: 'tests/reports/results.json' }],
    ['list'],
  ],
  timeout: 60_000,
  expect: { timeout: 10_000 },

  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:3100',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },

  projects: [
    // Auth setup - runs first, stores auth state
    {
      name: 'auth-setup',
      testMatch: /auth\.setup\.ts/,
    },
    // Browser E2E tests - 3 parallel browser sessions
    {
      name: 'chromium-1',
      use: { ...devices['Desktop Chrome'], storageState: 'tests/.auth/user.json' },
      dependencies: ['auth-setup'],
      testMatch: /\.(e2e|spec)\.(ts|js)$/,
      testIgnore: /api\./,
    },
    {
      name: 'chromium-2',
      use: { ...devices['Desktop Chrome'], storageState: 'tests/.auth/user.json', viewport: { width: 1440, height: 900 } },
      dependencies: ['auth-setup'],
      testMatch: /\.(e2e|spec)\.(ts|js)$/,
      testIgnore: /api\./,
    },
    // API tests - no browser needed
    {
      name: 'api-tests',
      use: { storageState: 'tests/.auth/user.json' },
      dependencies: ['auth-setup'],
      testMatch: /api\..*(spec|test)\.(ts|js)$/,
    },
  ],
});
