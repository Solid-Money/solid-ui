import { expect, test } from '@playwright/test';

test.describe('Bank Deposit Error Handling', () => {
  // Increase test timeout since the app is slow to load
  test.setTimeout(180000);

  test('should display user-friendly error message when bank deposit fails', async ({ page }) => {
    // Mock the bridge-customer API to return a customer (bypasses KYC redirect)
    await page.route('**/accounts/v1/bridge-customer', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          bridgeCustomerId: 'cust_123',
        }),
      });
    });

    // Mock customer endorsements API to return approved status
    await page.route('**/accounts/v1/bridge-customer/endorsements', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            name: 'base',
            status: 'approved',
          },
        ]),
      });
    });

    // Mock the bridge-transfers POST endpoint to return error with message
    await page.route('**/accounts/v1/bridge-transfers', async route => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({
            statusCode: 400,
            message: 'Customer is frozen. Contact us for more information',
            error: 'Bad Request',
          }),
        });
      } else {
        await route.continue();
      }
    });

    // Navigate to home page
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(5000); // Initial page load

    // Click the "Add funds" button
    const addFundsButton = page.getByText('Add funds').first();
    await expect(addFundsButton).toBeVisible({ timeout: 30000 });
    await addFundsButton.click({ force: true });
    await page.waitForTimeout(1000); // Delay for observation

    // Click "Bank Deposit" when visible
    const bankDepositOption = page.getByText('Bank Deposit').first();
    await expect(bankDepositOption).toBeVisible({ timeout: 10000 });
    await bankDepositOption.click({ force: true });
    await page.waitForTimeout(1000); // Delay for observation

    // Click Continue when visible
    const continueButton = page.getByText('Continue').first();
    await expect(continueButton).toBeVisible({ timeout: 10000 });
    await continueButton.click({ force: true });
    await page.waitForTimeout(1000); // Delay for observation

    // Click ACH Push when visible
    const achButton = page.getByText('ACH Push').first();
    await expect(achButton).toBeVisible({ timeout: 10000 });
    await achButton.click({ force: true });
    await page.waitForTimeout(1000); // Delay for observation

    // Verify the user-friendly error message is displayed in the toast
    await expect(page.getByText('Customer is frozen. Contact us for more information')).toBeVisible(
      {
        timeout: 10000,
      },
    );
    await page.waitForTimeout(2000); // Delay to see the toast
  });

  test('should display default error message when bank deposit API returns error without message', async ({
    page,
  }) => {
    // Mock the bridge-customer API
    await page.route('**/accounts/v1/bridge-customer', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          bridgeCustomerId: 'cust_123',
        }),
      });
    });

    // Mock customer endorsements API
    await page.route('**/accounts/v1/bridge-customer/endorsements', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            name: 'base',
            status: 'approved',
          },
        ]),
      });
    });

    // Mock the bridge-transfers POST endpoint to return error without message
    await page.route('**/accounts/v1/bridge-transfers', async route => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({
            statusCode: 500,
            error: 'Internal Server Error',
          }),
        });
      } else {
        await route.continue();
      }
    });

    // Navigate to home page
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(5000); // Initial page load

    // Click the "Add funds" button
    const addFundsButton = page.getByText('Add funds').first();
    await expect(addFundsButton).toBeVisible({ timeout: 30000 });
    await addFundsButton.click({ force: true });
    await page.waitForTimeout(1000); // Delay for observation

    // Click "Bank Deposit" when visible
    const bankDepositOption = page.getByText('Bank Deposit').first();
    await expect(bankDepositOption).toBeVisible({ timeout: 10000 });
    await bankDepositOption.click({ force: true });
    await page.waitForTimeout(1000); // Delay for observation

    // Click Continue when visible
    const continueButton = page.getByText('Continue').first();
    await expect(continueButton).toBeVisible({ timeout: 10000 });
    await continueButton.click({ force: true });
    await page.waitForTimeout(1000); // Delay for observation

    // Click ACH Push when visible
    const achButton = page.getByText('ACH Push').first();
    await expect(achButton).toBeVisible({ timeout: 10000 });
    await achButton.click({ force: true });
    await page.waitForTimeout(1000); // Delay for observation

    // Verify the default error message is displayed
    await expect(page.getByText('An error occurred while creating the transfer')).toBeVisible({
      timeout: 10000,
    });
    await page.waitForTimeout(2000); // Delay to see the toast
  });
});
