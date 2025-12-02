import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for E2E tests
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  // Use separate test directory to avoid conflicts with vitest
  testMatch: /.*\.spec\.ts$/,
  testDir: './tests',

  // Maximum time one test can run
  timeout: 30 * 1000,

  // Run tests in files in parallel
  fullyParallel: true,

  // Fail the build on CI if you accidentally left test.only in the source code
  forbidOnly: !!process.env.CI,

  // Retry on CI only
  retries: process.env.CI ? 2 : 0,

  // Opt out of parallel tests on CI
  workers: process.env.CI ? 1 : undefined,

  // Reporter to use
  reporter: 'html',

  // Expect timeout
  expect: { timeout: 7000 },

  // Shared settings for all the projects below
  use: {
    // Base URL to use in actions like `await page.goto('/')`
    baseURL: 'http://localhost:5173',

    // Deterministic timezone for E2E tests
    timezoneId: 'UTC',

    // Collect trace on failures and retries
    trace: 'retain-on-failure',

    // Take screenshot only on failure
    screenshot: 'only-on-failure',

    // Video on failure only
    video: 'retain-on-failure',
  },

  // Configure projects for major browsers
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },

    // Optionally test on other browsers
    // {
    //   name: 'firefox',
    //   use: { ...devices['Desktop Firefox'] },
    // },
    // {
    //   name: 'webkit',
    //   use: { ...devices['Desktop Safari'] },
    // },
  ],

  // Run your local dev server before starting the tests
  webServer: {
    command: 'ADAPTERS_PRESET=real E2E_TEST=1 VITE_API_URL=http://localhost:3001 VITE_APP_MODE=mock VITE_E2E=1 VITE_TENANT_API_KEY=pk_live_mais-e2e_0000000000000000 npm run dev:e2e',
    cwd: '..',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});
