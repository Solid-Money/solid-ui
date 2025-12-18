import { defineConfig, devices } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const authFile = path.join(__dirname, 'playwright/.auth/user.json');
const hasAuth = fs.existsSync(authFile);

if (!hasAuth) {
  console.error('\n❌ No auth state found at playwright/.auth/user.json');
  console.error('   Run: npm run generate:auth');
  console.error('   Then try again.\n');
  process.exit(1);
}

// In CI, use production; locally use dev server
const baseURL = process.env.CI ? 'https://app.solid.xyz' : 'http://localhost:8081';

export default defineConfig({
  testDir: './playwright/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL,
    trace: 'on-first-retry',
    navigationTimeout: 60000,
  },
  timeout: 60000,
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 },
        ...(hasAuth ? { storageState: authFile } : {}),
      },
    },
  ],
  // Only start webServer locally, not in CI
  ...(process.env.CI
    ? {}
    : {
        webServer: {
          command: 'npm run web',
          url: 'http://localhost:8081',
          reuseExistingServer: true,
          timeout: 120 * 1000,
        },
      }),
});
