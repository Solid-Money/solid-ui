# E2E Tests with Playwright

This directory contains end-to-end tests for the Solid frontend application using Playwright.

## Setup

Playwright is already configured for this project. The tests run against the Expo web build.

## Running Tests

### Run all tests
```bash
npm run test:e2e
```

### Run tests in UI mode (interactive)
```bash
npm run test:e2e:ui
```

### Run tests in debug mode
```bash
npm run test:e2e:debug
```

### View test report
```bash
npm run test:e2e:report
```

## Test Structure

- `tests/e2e/` - E2E test files
- `playwright.config.ts` - Playwright configuration
- `test-results/` - Test execution results (gitignored)
- `playwright-report/` - HTML test reports (gitignored)

## Writing Tests

Tests are written using Playwright's test framework. Example:

```typescript
import { test, expect } from '@playwright/test';

test('example test', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/Solid/);
});
```

## Current Tests

### Direct Deposit Modal Test
Tests the functionality of opening the direct deposit modal when clicking on a direct deposit activity item.

**Test File:** `tests/e2e/direct-deposit-modal.spec.ts`

**What it tests:**
- Clicking a direct deposit activity opens the modal
- Modal displays correct content
- Session data is properly set

**Current Status:** This test is expected to FAIL initially, as it's testing a known bug where the modal doesn't open properly.

## Debugging

1. Use `npm run test:e2e:debug` to step through tests
2. Use `npm run test:e2e:ui` for interactive debugging
3. Check screenshots in `test-results/` for failed tests
4. View traces in the HTML report

## CI/CD

In CI environments, tests will:
- Run with 2 retries
- Use a single worker
- Require passing tests before deployment

