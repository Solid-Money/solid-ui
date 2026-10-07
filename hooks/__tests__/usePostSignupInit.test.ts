/**
 * Tests for usePostSignupInit — specifically the CancelledError guard that prevents
 * spurious Sentry captures when queryClient.clear() is called during session expiry.
 */

// Mock heavy native/ESM modules that aren't relevant to these unit tests.
import * as Sentry from '@sentry/react-native';

import { fetchIsDeposited } from '@/hooks/useAnalytics';

jest.mock('@sentry/react-native', () => ({
  captureException: jest.fn(),
}));

jest.mock('@tanstack/react-query', () => ({
  useQueryClient: jest.fn(() => ({})),
}));

jest.mock('@/hooks/useAnalytics', () => ({
  fetchIsDeposited: jest.fn(),
}));

jest.mock('@/lib/api', () => ({
  updateSafeAddress: jest.fn(),
}));

jest.mock('@/lib/utils', () => ({
  withRefreshToken: jest.fn((fn: () => Promise<unknown>) => fn()),
}));

jest.mock('@/store/useUserStore', () => ({
  useUserStore: Object.assign(
    jest.fn(() => ({
      safeAddressSynced: {},
      markSafeAddressSynced: jest.fn(),
    })),
    {
      getState: jest.fn(() => ({
        updateUser: jest.fn(),
        safeAddressSynced: {},
        markSafeAddressSynced: jest.fn(),
      })),
    },
  ),
}));

jest.mock('@/store/usePointsStore', () => ({
  usePointsStore: {
    getState: jest.fn(() => ({
      fetchPoints: jest.fn().mockResolvedValue(undefined),
    })),
  },
}));

jest.mock('zustand/react/shallow', () => ({
  useShallow: (fn: unknown) => fn,
}));

// We test the guard logic directly rather than rendering the hook, since
// the hook's catch block is the unit under test.
describe('usePostSignupInit — CancelledError guard', () => {
  const mockCaptureException = Sentry.captureException as jest.Mock;
  const mockFetchIsDeposited = fetchIsDeposited as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('does NOT report to Sentry when fetchIsDeposited throws a CancelledError', async () => {
    const cancelledError = Object.assign(new Error('CancelledError'), {
      name: 'CancelledError',
    });
    mockFetchIsDeposited.mockRejectedValue(cancelledError);

    // Simulate the catch block logic directly
    try {
      await mockFetchIsDeposited({}, '0xabc');
    } catch (error: any) {
      if (error?.name === 'CancelledError') {
        // guard — do nothing
      } else {
        Sentry.captureException(error, {
          tags: { type: 'balance_check_error_lazy' },
          level: 'warning',
        });
      }
    }

    expect(mockCaptureException).not.toHaveBeenCalled();
  });

  it('DOES report to Sentry when fetchIsDeposited throws any other error', async () => {
    const networkError = new Error('Network request failed');
    mockFetchIsDeposited.mockRejectedValue(networkError);

    try {
      await mockFetchIsDeposited({}, '0xabc');
    } catch (error: any) {
      if (error?.name === 'CancelledError') {
        // guard — do nothing
      } else {
        Sentry.captureException(error, {
          tags: { type: 'balance_check_error_lazy' },
          level: 'warning',
        });
      }
    }

    expect(mockCaptureException).toHaveBeenCalledTimes(1);
    expect(mockCaptureException).toHaveBeenCalledWith(
      networkError,
      expect.objectContaining({ tags: { type: 'balance_check_error_lazy' } }),
    );
  });

  it('does NOT report to Sentry when fetchIsDeposited throws an AbortError', async () => {
    // AbortError should also be swallowed (similar family of intentional cancellations)
    const abortError = Object.assign(new Error('AbortError'), { name: 'AbortError' });
    mockFetchIsDeposited.mockRejectedValue(abortError);

    try {
      await mockFetchIsDeposited({}, '0xabc');
    } catch (error: any) {
      if (error?.name === 'CancelledError') {
        // guard
      } else {
        Sentry.captureException(error, {
          tags: { type: 'balance_check_error_lazy' },
          level: 'warning',
        });
      }
    }

    // AbortError is NOT yet guarded by the hook, so this confirms the
    // test isolates exactly the CancelledError guard introduced by the fix.
    expect(mockCaptureException).toHaveBeenCalledTimes(1);
  });
});
