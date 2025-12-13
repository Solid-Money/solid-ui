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

export default defineConfig({
  testDir: './playwright/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:8081',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Only use storageState if the auth file exists
        ...(hasAuth ? { storageState: authFile } : {}),
      },
    },
  ],
  webServer: {
    command: 'npm run web',
    url: 'http://localhost:8081',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});
