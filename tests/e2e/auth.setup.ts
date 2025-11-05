import { test as setup } from '@playwright/test';

/**
 * Authentication Setup for Playwright Tests
 * 
 * This setup will save the authentication state from your browser
 * so tests can reuse it without needing to log in each time.
 */

const authFile = 'playwright/.auth/user.json';

setup('use existing auth', async ({ page }) => {
  // Navigate to your app
  await page.goto('http://localhost:8081');

  // Wait for the app to be fully loaded
  await page.waitForLoadState('networkidle');

  // Give it a moment to ensure everything is loaded
  await page.waitForTimeout(2000);

  // Save the authentication state (cookies, localStorage, etc.)
  await page.context().storageState({ path: authFile });

  console.log('✅ Authentication state saved to:', authFile);
});

