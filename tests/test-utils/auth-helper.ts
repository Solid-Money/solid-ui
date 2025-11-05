/**
 * Test utilities for mocking authentication state
 */

export const TEST_USER = {
  userId: 'test-user-123',
  username: 'testuser',
  email: 'test@example.com',
  walletAddress: '0x1234567890123456789012345678901234567890',
};

/**
 * Sets up a mock authenticated user in the browser storage
 * This should be called in test beforeEach hooks
 */
export async function setupMockAuth(page: any) {
  await page.addInitScript(() => {
    // Mock the MMKV storage with a logged-in user
    const mockUserData = {
      userId: 'test-user-123',
      username: 'testuser',
      email: 'test@example.com',
      walletAddress: '0x1234567890123456789012345678901234567890',
    };

    // Set localStorage items that the app checks for authentication
    localStorage.setItem('users', JSON.stringify([mockUserData]));
    localStorage.setItem('current-user', JSON.stringify(mockUserData));
    localStorage.setItem('has-seen-onboarding', 'true');
    
    // Mock any other auth-related storage
    localStorage.setItem('auth-token', 'mock-token-123');
  });
}

/**
 * Clears all mock auth data
 */
export async function clearMockAuth(page: any) {
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
}

/**
 * Creates mock activity data with direct deposit transactions
 */
export function createMockDirectDepositActivity() {
  return {
    clientTxId: 'direct_deposit_test-session-123',
    title: 'Direct Deposit',
    shortTitle: 'Direct Deposit',
    amount: '0',
    status: 'pending',
    type: 'direct_deposit',
    chainId: 1,
    timestamp: Date.now(),
    symbol: 'USDC',
  };
}

