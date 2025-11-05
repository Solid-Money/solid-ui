import { expect, test } from '@playwright/test';

/**
 * Smoke Test: Basic Application Loading
 *
 * This test verifies that the application loads without crashing.
 * It doesn't test protected routes which require authentication.
 */

test.describe('Application Smoke Tests', () => {
  test('should load the application', async ({ page }) => {
    await page.goto('/');

    // Wait for the app to initialize
    await page.waitForLoadState('domcontentloaded');

    // The page should not be blank
    const body = await page.locator('body');
    await expect(body).toBeVisible();

    // Take a screenshot for visual verification
    await page.screenshot({ path: 'test-results/app-loaded.png', fullPage: true });
  });

  test('should have proper page title', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // Check if title is set
    await expect(page).toHaveTitle(/Solid/);
  });

  test('should redirect unauthenticated users appropriately', async ({ page }) => {
    // Try to access a protected route
    await page.goto('/');

    // Wait for any redirects to complete
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {
      // If timeout, that's okay
    });

    // The app should redirect to register/welcome/onboarding
    // Check if any of these expected routes are present
    const url = page.url();
    const isOnExpectedRoute =
      url.includes('/register') ||
      url.includes('/welcome') ||
      url.includes('/onboarding') ||
      url.includes('/overview');

    expect(isOnExpectedRoute).toBeTruthy();
  });
});

