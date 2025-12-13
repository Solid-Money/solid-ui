import { expect, test } from '@playwright/test';

test.describe('Dashboard', () => {
  test('should load the home page when authenticated', async ({ page }) => {
    // Navigate to home
    await page.goto('/');

    // Wait for the page to fully load
    await page.waitForLoadState('networkidle');

    // IMPORTANT: Verify we're actually authenticated by checking for
    // an element that only appears when logged in
    // "Your assets" text only shows on the authenticated home page
    await expect(page.getByText('Your assets')).toBeVisible({ timeout: 30000 });

    // Pause so you can see the page (5 seconds)
    await page.waitForTimeout(5000);
  });
});
