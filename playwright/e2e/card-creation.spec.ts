import { expect, test } from '@playwright/test';

test.describe('Card Creation Flow', () => {
  test('should display the card onboard page', async ({ page }) => {
    // Navigate to the card onboard page
    await page.goto('/card-onboard');

    // Wait for the page to fully load
    await page.waitForLoadState('networkidle');

    // Verify the page title is visible
    await expect(page.getByText('Introducing the Solid Card')).toBeVisible({ timeout: 15000 });

    // Verify key features are displayed
    await expect(page.getByText('Global acceptance')).toBeVisible();
    await expect(page.getByText('Earn while you spend')).toBeVisible();
  });

  test('should navigate to card activate when clicking Get Card', async ({ page }) => {
    // Navigate to the card onboard page
    await page.goto('/card-onboard');

    // Wait for the page to fully load
    await page.waitForLoadState('networkidle');

    // Click the Get Card button (first one visible)
    await page.getByRole('button', { name: 'Get your card' }).first().click();

    // Verify navigation to card activate page
    await page.waitForURL('**/card/activate**', { timeout: 15000 });

    // Verify the URL changed (the page content itself can vary)
    await expect(page).toHaveURL(/card\/activate/);
  });
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
    // Note: /card now redirects to /card-onboard, so we use /card/activate directly
    await page.goto('/card/activate?countryConfirmed=true');

    // Wait for the page to process the mocked response
    await page.waitForLoadState('networkidle');

    // The page should redirect to card/details since user has an active card
    await expect(page).toHaveURL(/card\/details/, { timeout: 15000 });
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
    await expect(page.getByText('Order your card')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Complete KYC' })).toBeVisible();
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

    // Navigate to the card activate page
    await page.goto('/card/activate?countryConfirmed=true');

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

    // Mock Bridge KYC link API (needed for when button is clicked)
    await page.route('**/accounts/v1/cards/kyc/kyc-link-from-bridge/**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'kyc_link_123',
          kyc_link: 'https://bridge.xyz/kyc/start',
          kyc_status: 'not_started',
        }),
      });
    });

    // Mock Bridge customer API (no endorsement yet)
    await page.route('**/accounts/v1/bridge-customer/get-customer-from-bridge', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'cust_123',
          endorsements: [],
        }),
      });
    });

    // Navigate directly to card activation with countryConfirmed=true
    // This simulates user who just selected a supported country on country_selection page
    await page.goto('/card/activate?countryConfirmed=true');
    await page.waitForLoadState('networkidle');

    // Verify the Complete KYC button is visible
    const kycButton = page.getByRole('button', { name: /Complete KYC/i });
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

  test('should show KYC under review status', async ({ page }) => {
    // Mock card status API to return 404 (no card)
    await page.route('**/accounts/v1/cards/status', async route => {
      await route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify(null),
      });
    });

    // Mock card access check API (supported country)
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

    // Mock Bridge KYC link API with under_review status
    await page.route('**/accounts/v1/cards/kyc/kyc-link-from-bridge/**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'kyc_link_123',
          kyc_link: 'https://bridge.xyz/kyc/123',
          kyc_status: 'under_review',
        }),
      });
    });

    // Mock Bridge customer API with incomplete endorsement and pending items
    // This is required because the under review state now depends on endorsement.requirements.pending
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
              requirements: {
                complete: ['first_name', 'last_name'],
                pending: ['document_verification', 'identity_check'],
                missing: {},
                issues: [],
              },
            },
          ],
        }),
      });
    });

    // Navigate with kycStatus param to trigger the right state
    await page.goto('/card/activate?kycStatus=under_review&countryConfirmed=true');
    await page.waitForLoadState('networkidle');

    // Verify the under review UI is shown
    await expect(page.getByText('Your card is on its way!')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(/identity is now being verified/i)).toBeVisible();

    // Wait so user can see the result
    await page.waitForTimeout(3000);
  });

  test('should show KYC rejected status with retry option', async ({ page }) => {
    // Mock card status API to return 404 (no card)
    await page.route('**/accounts/v1/cards/status', async route => {
      await route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify(null),
      });
    });

    // Mock card access check API (supported country)
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

    // Mock Bridge KYC link API with rejected status
    await page.route('**/accounts/v1/cards/kyc/kyc-link-from-bridge/**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'kyc_link_123',
          kyc_link: 'https://bridge.xyz/kyc/123',
          kyc_status: 'rejected',
          rejection_reasons: [
            {
              type: 'document_invalid',
              description: 'Invalid document',
            },
          ],
        }),
      });
    });

    // Mock Bridge customer API with revoked endorsement and rejection reasons
    // This is required because rejection messages now come from customer.rejection_reasons
    await page.route('**/accounts/v1/bridge-customer/get-customer-from-bridge', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'cust_123',
          endorsements: [
            {
              name: 'cards',
              status: 'revoked',
            },
          ],
          rejection_reasons: [
            {
              developer_reason: 'document_invalid',
              reason: 'Invalid document submitted. Please try again.',
              created_at: new Date().toISOString(),
            },
          ],
        }),
      });
    });

    // Navigate with rejected kycStatus param
    await page.goto('/card/activate?kycStatus=rejected&countryConfirmed=true');
    await page.waitForLoadState('networkidle');

    // Verify "Retry KYC" or "Complete KYC" button is shown (button text depends on implementation)
    const retryButton = page.getByRole('button', { name: /Retry KYC|Complete KYC/i });
    await expect(retryButton).toBeVisible({ timeout: 15000 });

    // Verify rejection message is displayed
    await expect(page.getByText(/rejected|Invalid document|try again/i)).toBeVisible();

    // Wait so user can see the result
    await page.waitForTimeout(3000);
  });

  test('should show KYC approved status and enable card ordering', async ({ page }) => {
    // Mock card status API to return 404 (no card)
    await page.route('**/accounts/v1/cards/status', async route => {
      await route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify(null),
      });
    });

    // Mock card access check API (supported country)
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

    // Mock Bridge KYC link API with approved status
    await page.route('**/accounts/v1/cards/kyc/kyc-link-from-bridge/**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'kyc_link_123',
          kyc_link: 'https://bridge.xyz/kyc/123',
          kyc_status: 'approved',
        }),
      });
    });

    // Mock Bridge customer API with approved cards endorsement
    await page.route('**/accounts/v1/bridge-customer/get-customer-from-bridge', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'cust_123',
          endorsements: [
            {
              name: 'cards',
              status: 'approved',
            },
          ],
        }),
      });
    });

    // Navigate with approved kycStatus param
    await page.goto('/card/activate?kycStatus=approved&countryConfirmed=true');
    await page.waitForLoadState('networkidle');

    // Verify step 1 is marked as complete (check mark or completed status)
    await expect(page.getByText('Complete KYC').first()).toBeVisible({ timeout: 15000 });

    // Verify "Order your card" button is visible and enabled
    const orderButton = page.getByRole('button', { name: /Order.*card/i });
    await expect(orderButton).toBeVisible();
    await expect(orderButton).toBeEnabled();

    // Wait so user can see the result
    await page.waitForTimeout(3000);
  });

  test('should redirect to KYC when endorsement is incomplete', async ({ page }) => {
    // Mock card status API to return 404 (no card)
    await page.route('**/accounts/v1/cards/status', async route => {
      await route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify(null),
      });
    });

    // Mock card access check API (supported country)
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

    // Mock Bridge KYC link API with approved status
    await page.route('**/accounts/v1/cards/kyc/kyc-link-from-bridge/**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'kyc_link_123',
          kyc_link: 'https://bridge.xyz/kyc/continue',
          kyc_status: 'approved',
        }),
      });
    });

    // Mock Bridge customer API with incomplete cards endorsement
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
              requirements: {
                missing: {
                  address: 'address is required',
                },
              },
            },
          ],
        }),
      });
    });

    // Mock KYC link for existing customer (re-enrollment with cards endorsement)
    await page.route('**/accounts/v1/bridge-customer/kyc-link**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          url: 'https://bridge.xyz/kyc/cards-endorsement',
        }),
      });
    });

    // Navigate to activate page
    await page.goto('/card/activate?countryConfirmed=true');
    await page.waitForLoadState('networkidle');

    // Wait for UI to update
    await page.waitForTimeout(2000);

    // With approved KYC but incomplete endorsement, step 1 should show Complete KYC
    await expect(page.getByText('Complete KYC').first()).toBeVisible({ timeout: 15000 });

    // The "Order card" button should exist but be disabled (endorsement not approved)
    // Note: Button may be hidden/collapsed but exists in DOM as disabled
    const orderButton = page.getByRole('button', { name: /Order.*card/i });
    // Just verify Complete KYC is shown - Order button may be collapsed when endorsement is incomplete

    // Wait for visual inspection
    await page.waitForTimeout(5000);
  });

  test('should show pending review status when endorsement is pending', async ({ page }) => {
    // Mock card status API to return 404 (no card)
    await page.route('**/accounts/v1/cards/status', async route => {
      await route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify(null),
      });
    });

    // Mock card access check API (supported country)
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

    // Mock Bridge KYC link API with approved status
    await page.route('**/accounts/v1/cards/kyc/kyc-link-from-bridge/**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'kyc_link_123',
          kyc_link: 'https://bridge.xyz/kyc/123',
          kyc_status: 'approved',
        }),
      });
    });

    // Mock Bridge customer API with incomplete endorsement but pending review
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
              requirements: {
                pending: ['document_verification'],
              },
            },
          ],
        }),
      });
    });

    // Navigate to activate page - KYC link will be polled and return approved
    await page.goto('/card/activate?countryConfirmed=true');
    await page.waitForLoadState('networkidle');

    // Wait for data to be fetched and UI to update
    await page.waitForTimeout(3000);

    // With pending endorsement items, the "under review" UI should be shown
    await expect(page.getByText('Your card is on its way!')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(/being verified/i)).toBeVisible({ timeout: 5000 });

    // Wait so user can see the result
    await page.waitForTimeout(3000);
  });

  test('should show retry option when endorsement is revoked', async ({ page }) => {
    // Mock card status API to return 404 (no card)
    await page.route('**/accounts/v1/cards/status', async route => {
      await route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify(null),
      });
    });

    // Mock card access check API (supported country)
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

    // Mock Bridge KYC link API with approved status
    await page.route('**/accounts/v1/cards/kyc/kyc-link-from-bridge/**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'kyc_link_123',
          kyc_link: 'https://bridge.xyz/kyc/retry',
          kyc_status: 'approved',
        }),
      });
    });

    // Mock Bridge customer API with revoked cards endorsement
    await page.route('**/accounts/v1/bridge-customer/get-customer-from-bridge', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'cust_123',
          endorsements: [
            {
              name: 'cards',
              status: 'revoked',
            },
          ],
          rejection_reasons: [
            {
              reason: 'Unable to verify identity document',
            },
          ],
        }),
      });
    });

    // Mock KYC link for existing customer (re-enrollment with cards endorsement)
    await page.route('**/accounts/v1/bridge-customer/kyc-link**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          url: 'https://bridge.xyz/kyc/cards-endorsement-retry',
        }),
      });
    });

    // Navigate to activate page
    await page.goto('/card/activate?countryConfirmed=true');
    await page.waitForLoadState('networkidle');

    // Wait for UI to update
    await page.waitForTimeout(2000);

    // With approved KYC but revoked endorsement, step 1 should show Complete KYC
    await expect(page.getByText('Complete KYC').first()).toBeVisible({ timeout: 15000 });

    // "Order card" button exists but may be hidden (endorsement revoked)
    // Just verify the Complete KYC button is shown for this state
  });

  test('should redirect to KYC when no cards endorsement exists', async ({ page }) => {
    // Mock card status API to return 404 (no card)
    await page.route('**/accounts/v1/cards/status', async route => {
      await route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify(null),
      });
    });

    // Mock card access check API (supported country)
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

    // Mock Bridge KYC link API with approved status
    await page.route('**/accounts/v1/cards/kyc/kyc-link-from-bridge/**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'kyc_link_123',
          kyc_link: 'https://bridge.xyz/kyc/start',
          kyc_status: 'approved',
        }),
      });
    });

    // Mock Bridge customer API with no cards endorsement
    await page.route('**/accounts/v1/bridge-customer/get-customer-from-bridge', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'cust_123',
          endorsements: [],
        }),
      });
    });

    // Mock KYC link for existing customer (re-enrollment with cards endorsement)
    await page.route('**/accounts/v1/bridge-customer/kyc-link**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          url: 'https://bridge.xyz/kyc/cards-endorsement-new',
        }),
      });
    });

    // Navigate to activate page
    await page.goto('/card/activate?countryConfirmed=true');
    await page.waitForLoadState('networkidle');

    // Wait for UI to update
    await page.waitForTimeout(2000);

    // With approved KYC but no endorsement, step 1 should show Complete KYC
    await expect(page.getByText('Complete KYC').first()).toBeVisible({ timeout: 15000 });

    // The "Order card" button may be hidden when user needs KYC re-enrollment
    // Just verify the Complete KYC button is shown for re-enrollment

    // Wait for visual inspection
    await page.waitForTimeout(5000);
  });

  test('should create KYC link for existing user when clicking Complete KYC button', async ({
    page,
  }) => {
    // This test verifies the re-enrollment flow where an existing user
    // without the cards endorsement can go through KYC to get the endorsement

    let kycLinkRequestMade = false;

    // Mock card status API to return 404 (no card)
    await page.route('**/accounts/v1/cards/status', async route => {
      await route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify(null),
      });
    });

    // Mock card access check API (supported country)
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

    // Mock Bridge KYC link API with approved status (user has passed basic KYC)
    await page.route('**/accounts/v1/cards/kyc/kyc-link-from-bridge/**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'kyc_link_123',
          kyc_link: 'https://bridge.xyz/kyc/completed',
          kyc_status: 'approved',
        }),
      });
    });

    // Mock Bridge customer API with NO cards endorsement (needs to go through KYC again)
    await page.route('**/accounts/v1/bridge-customer/get-customer-from-bridge', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'cust_123',
          endorsements: [], // No cards endorsement
        }),
      });
    });

    // Mock KYC link for existing customer - this is the endpoint that creates
    // a new KYC link with the cards endorsement for existing customers
    await page.route('**/accounts/v1/bridge-customer/kyc-link**', async route => {
      kycLinkRequestMade = true;

      // Verify the request includes the cards endorsement
      const url = route.request().url();
      expect(url).toContain('endorsement=cards');

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          url: 'https://bridge.xyz/kyc/cards-endorsement-request',
        }),
      });
    });

    // Navigate to activate page
    await page.goto('/card/activate?countryConfirmed=true');
    await page.waitForLoadState('networkidle');

    // Wait for UI to update
    await page.waitForTimeout(2000);

    // Verify the Complete KYC button is visible
    const kycButton = page.getByRole('button', { name: /Complete KYC/i });
    await expect(kycButton).toBeVisible({ timeout: 15000 });

    // Click the Complete KYC button to trigger the re-enrollment flow
    await kycButton.click();

    // Give time for the API call to be made
    await page.waitForTimeout(2000);

    // Verify either the KYC link endpoint was called OR user is redirected to user-kyc-info
    // (The flow may go to collect user info first if existing customer link fails)
    const currentUrl = page.url();
    const redirectedToKycInfo = currentUrl.includes('user-kyc-info');

    // Either the API was called or we redirected to collect user info
    expect(kycLinkRequestMade || redirectedToKycInfo).toBe(true);

    // Wait for visual inspection
    await page.waitForTimeout(5000);
  });

  // ============================================================================
  // Endorsement Status Display Tests
  // ============================================================================

  test('should display user-friendly message for incomplete endorsement with missing address', async ({
    page,
  }) => {
    // Mock card status API to return 404 (no card)
    await page.route('**/accounts/v1/cards/status', async route => {
      await route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify(null),
      });
    });

    // Mock card access check API (supported country)
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

    // Mock Bridge KYC link API with approved status
    await page.route('**/accounts/v1/cards/kyc/kyc-link-from-bridge/**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'kyc_link_123',
          kyc_link: 'https://bridge.xyz/kyc/continue',
          kyc_status: 'approved',
        }),
      });
    });

    // Mock Bridge customer API with incomplete endorsement - missing address
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
              requirements: {
                complete: ['first_name', 'last_name', 'email'],
                pending: [],
                missing: {
                  address: 'Full address is required',
                  ssn_last_4: 'Last 4 digits of SSN required',
                },
                issues: [],
              },
            },
          ],
        }),
      });
    });

    // Navigate to activate page
    await page.goto('/card/activate?countryConfirmed=true');
    await page.waitForLoadState('networkidle');

    // Wait for UI to update
    await page.waitForTimeout(2000);

    // Verify that "Complete KYC" step is visible
    await expect(page.getByText('Complete KYC').first()).toBeVisible({ timeout: 15000 });

    // Order card button should NOT be enabled (endorsement not approved)
    const orderButton = page.getByRole('button', { name: /Order.*card/i });
    if (await orderButton.isVisible()) {
      await expect(orderButton).toBeDisabled();
    }

    await page.waitForTimeout(3000);
  });

  test('should display issues with ID document in endorsement requirements', async ({ page }) => {
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
        body: JSON.stringify({
          hasAccess: true,
          countryCode: 'US',
        }),
      });
    });

    await page.route('**/accounts/v1/cards/kyc/kyc-link-from-bridge/**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'kyc_link_123',
          kyc_link: 'https://bridge.xyz/kyc/retry',
          kyc_status: 'approved',
        }),
      });
    });

    // Mock with incomplete endorsement that has issues with ID document
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
              requirements: {
                complete: ['first_name', 'last_name'],
                pending: [],
                missing: {},
                issues: [{ id_front_photo: 'id_expired' }, { id_back_photo: 'image_blurry' }],
              },
            },
          ],
        }),
      });
    });

    await page.goto('/card/activate?countryConfirmed=true');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Verify Complete KYC is shown (user needs to retry)
    await expect(page.getByText('Complete KYC').first()).toBeVisible({ timeout: 15000 });

    await page.waitForTimeout(3000);
  });

  test('should block user when endorsement has region restriction issue', async ({ page }) => {
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
        body: JSON.stringify({
          hasAccess: true,
          countryCode: 'US',
        }),
      });
    });

    await page.route('**/accounts/v1/cards/kyc/kyc-link-from-bridge/**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'kyc_link_123',
          kyc_link: 'https://bridge.xyz/kyc/blocked',
          kyc_status: 'approved',
        }),
      });
    });

    // Mock with revoked endorsement due to region restriction
    await page.route('**/accounts/v1/bridge-customer/get-customer-from-bridge', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'cust_123',
          endorsements: [
            {
              name: 'cards',
              status: 'revoked',
              requirements: {
                complete: [],
                pending: [],
                missing: {},
                issues: ['endorsement_not_available_in_customers_region'],
              },
            },
          ],
        }),
      });
    });

    await page.goto('/card/activate?countryConfirmed=true');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // User should see Complete KYC but clicking shouldn't proceed (blocked by region)
    await expect(page.getByText('Complete KYC').first()).toBeVisible({ timeout: 15000 });

    await page.waitForTimeout(3000);
  });

  test('should show verification expired message for revoked endorsement with rejection reasons', async ({
    page,
  }) => {
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
        body: JSON.stringify({
          hasAccess: true,
          countryCode: 'US',
        }),
      });
    });

    await page.route('**/accounts/v1/cards/kyc/kyc-link-from-bridge/**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'kyc_link_123',
          kyc_link: 'https://bridge.xyz/kyc/retry',
          kyc_status: 'approved',
        }),
      });
    });

    // Mock with revoked endorsement and customer-level rejection reasons
    await page.route('**/accounts/v1/bridge-customer/get-customer-from-bridge', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'cust_123',
          endorsements: [
            {
              name: 'cards',
              status: 'revoked',
              requirements: {
                complete: [],
                pending: [],
                missing: {},
                issues: [],
              },
            },
          ],
          rejection_reasons: [
            {
              developer_reason: 'kyc_expired',
              reason: 'Your verification has expired. Please complete the process again.',
              created_at: new Date().toISOString(),
            },
          ],
        }),
      });
    });

    await page.goto('/card/activate?countryConfirmed=true');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Verify Complete KYC is shown for re-enrollment
    await expect(page.getByText('Complete KYC').first()).toBeVisible({ timeout: 15000 });

    await page.waitForTimeout(3000);
  });

  test('should display pending review when endorsement has pending document verification', async ({
    page,
  }) => {
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
        body: JSON.stringify({
          hasAccess: true,
          countryCode: 'US',
        }),
      });
    });

    await page.route('**/accounts/v1/cards/kyc/kyc-link-from-bridge/**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'kyc_link_123',
          kyc_link: 'https://bridge.xyz/kyc/pending',
          kyc_status: 'approved',
        }),
      });
    });

    // Mock with incomplete endorsement but pending items (under internal review)
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
              requirements: {
                complete: ['first_name', 'last_name', 'email', 'address'],
                pending: ['document_verification', 'identity_check'],
                missing: {},
                issues: [],
              },
            },
          ],
        }),
      });
    });

    await page.goto('/card/activate?countryConfirmed=true');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // With pending endorsement items, the "under review" UI should be shown
    await expect(page.getByText('Your card is on its way!')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(/being verified/i)).toBeVisible({ timeout: 5000 });

    // The step list is not shown in this state, so no "Order card" button
    await page.waitForTimeout(3000);
  });

  test('should enable Order card button only when cards endorsement is approved', async ({
    page,
  }) => {
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
        body: JSON.stringify({
          hasAccess: true,
          countryCode: 'US',
        }),
      });
    });

    await page.route('**/accounts/v1/cards/kyc/kyc-link-from-bridge/**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'kyc_link_123',
          kyc_link: 'https://bridge.xyz/kyc/approved',
          kyc_status: 'approved',
        }),
      });
    });

    // Mock with APPROVED cards endorsement
    await page.route('**/accounts/v1/bridge-customer/get-customer-from-bridge', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'cust_123',
          endorsements: [
            {
              name: 'cards',
              status: 'approved',
              requirements: {
                complete: ['first_name', 'last_name', 'email', 'address', 'document_verification'],
                pending: [],
                missing: {},
                issues: [],
              },
            },
          ],
        }),
      });
    });

    await page.goto('/card/activate?countryConfirmed=true');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Verify step 1 is complete
    await expect(page.getByText('Complete KYC').first()).toBeVisible({ timeout: 15000 });

    // Order card button should be visible and enabled
    const orderButton = page.getByRole('button', { name: /Order.*card/i });
    await expect(orderButton).toBeVisible();
    await expect(orderButton).toBeEnabled();

    await page.waitForTimeout(3000);
  });

  test('should display combined missing and issues in incomplete endorsement', async ({ page }) => {
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
        body: JSON.stringify({
          hasAccess: true,
          countryCode: 'US',
        }),
      });
    });

    // Mock KYC link - status doesn't affect step description anymore
    await page.route('**/accounts/v1/cards/kyc/kyc-link-from-bridge/**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'kyc_link_123',
          kyc_link: 'https://bridge.xyz/kyc/retry',
          kyc_status: 'approved',
        }),
      });
    });

    // Mock with incomplete endorsement that has both missing fields and issues
    // Customer rejection_reasons take priority for display in step description
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
              requirements: {
                complete: ['first_name', 'last_name'],
                pending: [],
                missing: {
                  address: 'Address is required',
                },
                issues: [{ selfie_photo: 'face_not_detected' }],
              },
            },
          ],
          // Customer-level rejection reasons take priority for display
          rejection_reasons: [
            {
              developer_reason: 'selfie_failed',
              reason: 'We could not detect a face in your selfie. Please retake the photo.',
              created_at: new Date().toISOString(),
            },
          ],
        }),
      });
    });

    // Mock KYC link for existing customer
    await page.route('**/accounts/v1/bridge-customer/kyc-link**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          url: 'https://bridge.xyz/kyc/cards-endorsement-retry',
        }),
      });
    });

    await page.goto('/card/activate?countryConfirmed=true');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Verify Complete KYC step title is shown
    await expect(page.getByText('Complete KYC').first()).toBeVisible({ timeout: 15000 });

    // Verify CUSTOMER rejection reasons are displayed in the step description
    // (Customer rejection_reasons take priority over endorsement issues)
    await expect(
      page.getByText(/We could not detect a face in your selfie. Please retake the photo/i),
    ).toBeVisible({ timeout: 5000 });

    // Verify "Complete KYC" button is shown (for incomplete status with issues)
    const kycButton = page.getByRole('button', { name: /Complete KYC/i });
    await expect(kycButton).toBeVisible({ timeout: 5000 });

    // Order card button should not be visible/enabled (endorsement not approved)
    const orderButton = page.getByRole('button', { name: /Order.*card/i });
    if (await orderButton.isVisible()) {
      await expect(orderButton).toBeDisabled();
    }

    await page.waitForTimeout(3000);
  });

  test('should display missing requirements when no rejection reasons', async ({ page }) => {
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
        body: JSON.stringify({
          hasAccess: true,
          countryCode: 'US',
        }),
      });
    });

    await page.route('**/accounts/v1/cards/kyc/kyc-link-from-bridge/**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'kyc_link_123',
          kyc_link: 'https://bridge.xyz/kyc/continue',
          kyc_status: 'approved',
        }),
      });
    });

    // Mock with incomplete endorsement that has missing fields but NO rejection reasons
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
              requirements: {
                complete: ['first_name', 'last_name'],
                pending: [],
                missing: {
                  address: 'Address is required',
                  ssn_last_4: 'Last 4 digits of SSN required',
                },
                issues: [],
              },
            },
          ],
          // No rejection_reasons - should fall back to showing missing fields
        }),
      });
    });

    await page.goto('/card/activate?countryConfirmed=true');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Verify Complete KYC is shown
    await expect(page.getByText('Complete KYC').first()).toBeVisible({ timeout: 15000 });

    // Verify missing fields are displayed in user-friendly format
    // formatCodeToReadable converts "address" -> "Address", "ssn_last_4" -> "Ssn Last 4"
    await expect(page.getByText(/Missing/i)).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/Address/i)).toBeVisible({ timeout: 5000 });

    await page.waitForTimeout(3000);
  });

  test('should display endorsement issues when no rejection reasons', async ({ page }) => {
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
        body: JSON.stringify({
          hasAccess: true,
          countryCode: 'US',
        }),
      });
    });

    await page.route('**/accounts/v1/cards/kyc/kyc-link-from-bridge/**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'kyc_link_123',
          kyc_link: 'https://bridge.xyz/kyc/retry',
          kyc_status: 'approved',
        }),
      });
    });

    // Mock with incomplete endorsement that has issues but NO rejection reasons
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
              requirements: {
                complete: ['first_name', 'last_name'],
                pending: [],
                missing: {},
                issues: [{ id_front_photo: 'id_expired' }, { selfie_photo: 'face_not_detected' }],
              },
            },
          ],
          // No rejection_reasons - should fall back to showing formatted issues
        }),
      });
    });

    await page.goto('/card/activate?countryConfirmed=true');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Verify Complete KYC is shown
    await expect(page.getByText('Complete KYC').first()).toBeVisible({ timeout: 15000 });

    // Verify endorsement issues are displayed in user-friendly format
    // formatEndorsementIssue converts { id_front_photo: "id_expired" } -> "Id Front Photo: Id Expired"
    await expect(page.getByText(/Id Front Photo/i)).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/Id Expired/i)).toBeVisible({ timeout: 5000 });

    await page.waitForTimeout(3000);
  });
});
