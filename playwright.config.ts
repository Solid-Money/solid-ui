import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for testing Expo Web application
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',

  use: {
    baseURL: 'http://localhost:8081',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    // Test project - uses saved auth state
    // Make sure playwright/.auth/user.json exists before running!
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Use the saved authentication state
        storageState: 'playwright/.auth/user.json',
      },
    },
  ],

  webServer: {
    command: 'npm run web',
    url: 'http://localhost:8081',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});

