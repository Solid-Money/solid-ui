import { expect, test } from '@playwright/test';

/**
 * KYC Link Flow Tests
 *
 * Tests the fix for parsing inquiry-id (used for existing customers going through KYC again).
 */
test.describe('KYC Link Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/accounts/v1/cards/status', async route => {
      await route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify(null),
      });
    });

    await page.route('**/accounts/v1/cards/check-access**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ hasAccess: true, countryCode: 'US' }),
      });
    });

    await page.route('**/accounts/v1/bridge-customer/get-customer-from-bridge', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'cust_123',
          endorsements: [
            {
              name: 'cards',
              status: 'incomplete',
              requirements: { missing: { address: 'address is required' } },
            },
          ],
        }),
      });
    });

    await page.route('**/accounts/v1/bridge-customer/kyc-link**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          url: 'https://bridge.withpersona.com/inquiry?inquiry-id=inq_8r2VJjD1opuTZ7s5zfJgvtSsKrGk',
        }),
      });
    });

    await page.route('**/accounts/v1/cards/kyc/kyc-link-from-bridge/**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'kyc_link_123',
          kyc_link:
            'https://bridge.withpersona.com/inquiry?inquiry-id=inq_8r2VJjD1opuTZ7s5zfJgvtSsKrGk',
          kyc_status: 'approved',
        }),
      });
    });

    // Mock createKycLink API for user-kyc-info page
    await page.route('**/accounts/v1/cards/kyc/link', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          kycLinkId: 'kyc_link_123',
          link: 'https://bridge.withpersona.com/inquiry?inquiry-id=inq_8r2VJjD1opuTZ7s5zfJgvtSsKrGk',
        }),
      });
    });
  });

  test('should parse inquiry-id from existing customer KYC link', async ({ page }) => {
    // Navigate to card activation
    await page.goto('/card/activate?countryConfirmed=true');
    await page.waitForLoadState('networkidle');

    // Click Complete KYC button
    const kycButton = page.getByRole('button', { name: /Complete KYC/i });
    await expect(kycButton).toBeVisible({ timeout: 15000 });
    await kycButton.click();

    // Wait for navigation to user-kyc-info
    await page.waitForTimeout(1500);
    const currentUrl = page.url();

    // If redirected to user-kyc-info, fill out the form
    if (currentUrl.includes('user-kyc-info')) {
      // Fill in the form inputs
      const fullNameInput = page.locator('input').first();
      await fullNameInput.fill('Test User');

      const emailInput = page.locator('input').nth(1);
      await emailInput.fill('test@example.com');

      // Click the checkbox boxes (custom Pressable components)
      const checkboxes = page.locator('.w-6.h-6.rounded');
      const checkboxCount = await checkboxes.count();
      for (let i = 0; i < checkboxCount; i++) {
        await checkboxes.nth(i).click();
      }

      // Click Continue button
      const continueButton = page.getByRole('button', { name: /Continue/i });
      await expect(continueButton).toBeEnabled({ timeout: 5000 });
      await continueButton.click();

      // Wait for navigation to KYC page
      await page.waitForURL('**/kyc**', { timeout: 15000 });
    }

    // Should NOT show "Missing templateId or inquiryId" error (the bug we fixed)
    await expect(page.getByText('Missing templateId or inquiryId')).not.toBeVisible({
      timeout: 5000,
    });

    // Should show KYC page title
    await expect(page.getByText('Verify identity')).toBeVisible({ timeout: 5000 });
  });

  test('should show error when both templateId and inquiryId are missing', async ({ page }) => {
    const invalidUrl = 'https://withpersona.com/verify?environment-id=env_test';

    await page.goto(`/kyc?url=${encodeURIComponent(invalidUrl)}`);
    await page.waitForLoadState('networkidle');

    await expect(page.getByText('Missing templateId or inquiryId')).toBeVisible({ timeout: 5000 });
  });

  test('should show error when no URL is provided', async ({ page }) => {
    await page.goto('/kyc');
    await page.waitForLoadState('networkidle');

    await expect(page.getByText('No URL provided')).toBeVisible({ timeout: 5000 });
  });
});
