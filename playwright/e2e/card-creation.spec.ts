import { expect, Page, test } from '@playwright/test';

test.describe('Card Creation Flow', () => {
  // /card and /card-onboard both used to render the standalone card waitlist
  // page, and /card/details rendered the card screen. All three are redirect shims
  // now, so none should ever paint their old page — getting a card starts at
  // country selection, and the card itself lives on the wallet page. The
  // country-selection → activate hand-off is covered by the "traveling user" test
  // below.
  for (const deprecatedRoute of ['/card', '/card-onboard', '/card/details']) {
    test(`should redirect away from the deprecated ${deprecatedRoute} page`, async ({ page }) => {
      await page.goto(deprecatedRoute);

      // Wait for the page to fully load
      await page.waitForLoadState('networkidle');

      // The shim replaces itself, so the URL must have moved on
      await expect(page).not.toHaveURL(new RegExp(`${deprecatedRoute}/?$`), { timeout: 15000 });

      // And none of the retired waitlist copy should be on screen
      await expect(page.getByText('Introducing the Solid Card')).toHaveCount(0);
      await expect(page.getByText('Global acceptance')).toHaveCount(0);
    });
  }
});

test.describe('Card Creation Flow - With Mocking', () => {
  test('should redirect to card details when user has an active card', async ({ page }) => {
    // Mock the card status API to return an active card
    await page.route('**/accounts/v1/cards/status', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'active',
        }),
      });
    });

    // Navigate to the card/activate page (which checks card status and redirects)
    // Note: /card is only a redirect shim now, so we use /card/activate directly
    await page.goto('/card/activate?countryConfirmed=true');

    // Wait for the page to process the mocked response
    await page.waitForLoadState('networkidle');

    // An active-card user lands on the card details surface, which is the wallet
    // page with its card pane open (`/?screen=card-info`). `/card/details` is only
    // a redirect onto that now, so asserting on it would pass on the shim rather
    // than on where the user actually ends up.
    await expect(page).toHaveURL(/screen=card-info/, { timeout: 15000 });
  });

  test('should show KYC steps when user is from supported country', async ({ page }) => {
    // Mock the card status API to return 404 (no card)
    await page.route('**/accounts/v1/cards/status', async route => {
      await route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify(null),
      });
    });

    // Mock IP detection API (ipify)
    await page.route('**/api.ipify.org/**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ip: '8.8.8.8' }), // US IP
      });
    });

    // Mock country from IP API (ipapi.co)
    await page.route('**/ipapi.co/**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          country_code: 'US',
          country_name: 'United States',
        }),
      });
    });

    // Mock card access check API (US is supported)
    await page.route('**/accounts/v1/cards/check-access**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          hasAccess: true,
          countryCode: 'US',
        }),
      });
    });

    // Navigate to the card activate page (with countryConfirmed to skip country check)
    await page.goto('/card/activate?countryConfirmed=true');

    // Wait for the page to fully load
    await page.waitForLoadState('networkidle');

    // Verify the activation steps are displayed
    await expect(page.getByText('Complete KYC').first()).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Activate your card')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Continue verification' })).toBeVisible();
  });

  test('should redirect to country selection when user is from unsupported country', async ({
    page,
  }) => {
    // Mock the card status API to return 404 (no card)
    await page.route('**/accounts/v1/cards/status', async route => {
      await route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify(null),
      });
    });

    // Mock IP detection API (ipify)
    await page.route('**/api.ipify.org/**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ip: '1.2.3.4' }), // Unsupported IP
      });
    });

    // Mock country from IP API (ipapi.co) - Russia (unsupported)
    await page.route('**/ipapi.co/**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          country_code: 'RU',
          country_name: 'Russia',
        }),
      });
    });

    // Mock card access check API (Russia is NOT supported)
    await page.route('**/accounts/v1/cards/check-access**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          hasAccess: false,
          countryCode: 'RU',
        }),
      });
    });

    // Navigate to the card activate page (without countryConfirmed to trigger country check)
    await page.goto('/card/activate');

    // Wait for redirect to country selection
    await page.waitForURL('**/card-onboard/country_selection**', { timeout: 15000 });

    // Verify we're on country selection page
    await expect(page).toHaveURL(/country_selection/);
  });

  test('should allow traveling user to select supported country and proceed', async ({ page }) => {
    // Mock IP detection to fail (so country selector shows directly)
    await page.route('**/api.ipify.org/**', async route => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Failed' }),
      });
    });

    // Mock card access check API for US (will be called when user selects US)
    await page.route('**/accounts/v1/cards/check-access**', async route => {
      const url = route.request().url();
      if (url.includes('US')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            hasAccess: true,
            countryCode: 'US',
          }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            hasAccess: false,
            countryCode: 'OTHER',
          }),
        });
      }
    });

    // Navigate directly to country selection (simulating user was redirected)
    await page.goto('/card-onboard/country_selection');

    // Wait for the page to fully load
    await page.waitForLoadState('networkidle');

    // Verify country selection page is displayed
    await expect(page.getByText('Country of residence', { exact: true })).toBeVisible({
      timeout: 15000,
    });

    // Open country dropdown and select United States
    await page.getByText('Select country').click();
    await page.getByRole('textbox').fill('United States');
    await page.getByText('United States').click();

    // Click OK button
    await page.getByRole('button', { name: 'Ok' }).click();

    // Verify navigation to card activation
    await page.waitForURL('**/card/activate**', { timeout: 15000 });
    await expect(page).toHaveURL(/card\/activate/);

    // Wait a bit so user can see the result
    await page.waitForTimeout(3000);
  });

  test('should allow KYC button click after manually selecting supported country', async ({
    page,
  }) => {
    // This test verifies the bug fix: after manually selecting a supported country
    // (simulated by countryConfirmed=true param), clicking the KYC button
    // should NOT show "Country not supported" toast

    // Mock card status API to return 404 (no card)
    await page.route('**/accounts/v1/cards/status', async route => {
      await route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify(null),
      });
    });

    // Mock card access check API - supported country
    await page.route('**/accounts/v1/cards/check-access**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          hasAccess: true,
          countryCode: 'US',
        }),
      });
    });

    // Navigate directly to card activation with countryConfirmed=true
    // This simulates user who just selected a supported country on country_selection page
    await page.goto('/card/activate?countryConfirmed=true');
    await page.waitForLoadState('networkidle');

    // Verify the Complete KYC button is visible
    const kycButton = page.getByRole('button', { name: /Continue verification/i });
    await expect(kycButton).toBeVisible({ timeout: 15000 });

    // Click the Complete KYC button
    // This should NOT show "Country not supported" toast
    await kycButton.click();

    // Wait a moment to see if toast appears
    await page.waitForTimeout(1500);

    // Verify NO "Country not supported" toast is shown
    const errorToast = page.getByText('Country not supported');
    await expect(errorToast).not.toBeVisible();

    // The user should either be redirected to KYC or user-kyc-info page
    // (depending on whether they have existing customer data)
    // Just verify no blocking toast appeared
  });

  /**
   * The KYC step reads `/cards/status` alone. These used to be driven by the
   * bridge.xyz customer's "cards" endorsement, which is retired along with
   * Bridge cards; the client no longer asks for it.
   */
  const mockCardStatus = async (page: Page, body: Record<string, unknown>) => {
    await page.route('**/accounts/v1/cards/status', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ depositRequired: false, ...body }),
      });
    });
    await page.route('**/accounts/v1/cards/check-access**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ hasAccess: true, countryCode: 'US' }),
      });
    });
  };

  test('should show KYC under review status', async ({ page }) => {
    await mockCardStatus(page, { kycStatus: 'under_review' });

    await page.goto('/card/activate?kycStatus=under_review&countryConfirmed=true');
    await page.waitForLoadState('networkidle');

    await expect(page.getByText('Your card is on its way!')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(/identity is now being verified/i)).toBeVisible();
  });

  test('should show KYC rejected status without an action', async ({ page }) => {
    await mockCardStatus(page, { kycStatus: 'rejected' });

    await page.goto('/card/activate?kycStatus=rejected&countryConfirmed=true');
    await page.waitForLoadState('networkidle');

    await expect(page.getByText('Complete KYC').first()).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Your identity verification was declined.')).toBeVisible();
    await expect(page.getByRole('button', { name: /Continue verification/i })).not.toBeVisible();
    await expect(page.getByRole('button', { name: /Activate card/i })).not.toBeVisible();
  });

  test('should show KYC approved status and enable card activation', async ({ page }) => {
    await mockCardStatus(page, { kycStatus: 'approved' });

    await page.goto('/card/activate?kycStatus=approved&countryConfirmed=true');
    await page.waitForLoadState('networkidle');

    await expect(page.getByText('Complete KYC').first()).toBeVisible({ timeout: 15000 });
    const activateButton = page.getByRole('button', { name: /Activate card/i });
    await expect(activateButton).toBeVisible();
    await expect(activateButton).toBeEnabled();
  });
});
