import { expect, test } from '@playwright/test';

/**
 * E2E Test: Direct Deposit Modal Opening from Activity
 *
 * This test verifies that when a direct deposit activity item is clicked,
 * the direct deposit modal opens and is visible.
 *
 * Current Issue: The modal is not opening when clicking direct deposit activities.
 */

test.describe('Direct Deposit Modal', () => {
  test('should open modal when clicking a direct deposit activity', async ({ page }) => {
    // Navigate to the activity page
    await page.goto('/activity');

    // Wait for the page to load
    await page.waitForLoadState('networkidle');

    // Look for any activity transaction in the list
    // Direct deposit activities have clientTxId starting with 'direct_deposit_'
    const activityList = page.locator('[class*="Transaction"]').first();

    // Wait for at least one transaction to be visible
    await expect(activityList).toBeVisible({ timeout: 10000 });

    // Click the first transaction (assuming it's a direct deposit for this test)
    // In a real scenario, you'd want to ensure it's specifically a direct deposit
    await activityList.click();

    // Check if the modal is now visible
    // The modal should have role="dialog"
    const modal = page.locator('[role="dialog"]');

    // Assert: Modal should be visible after clicking
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Additional verification: Modal should contain deposit-related content
    // This confirms it's the right modal, not some other dialog
    const modalContent = modal.locator('text=/deposit|address|network/i');
    await expect(modalContent).toBeVisible();
  });
});
