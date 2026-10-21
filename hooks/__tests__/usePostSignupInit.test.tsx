import React from 'react';
import * as Sentry from '@sentry/react-native';

import { usePostSignupInit } from '@/hooks/usePostSignupInit';
import { User } from '@/lib/types';
import { useUserStore } from '@/store/useUserStore';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { act, create } = require('react-test-renderer');

/**
 * Once the app has loaded, a signed-in account whose Safe address the server
 * may not have yet is saved again, then its balance and points are loaded.
 * Login saves the address too, so the two can race, and the loser is answered
 * 409 — which must not cost the session its balance and points.
 */

const mockUpdateSafeAddress = jest.fn();
const mockFetchIsDeposited = jest.fn();
const mockFetchPoints = jest.fn();

jest.mock('@sentry/react-native', () => ({
  addBreadcrumb: jest.fn(),
  captureException: jest.fn(),
  captureMessage: jest.fn(),
}));
// The user store persists through MMKV, which has no native module under jest.
jest.mock('@/lib/mmvkStorage', () => ({
  __esModule: true,
  default: () => ({
    setItem: jest.fn(),
    getItem: () => null,
    removeItem: jest.fn(),
  }),
}));
jest.mock('@tanstack/react-query', () => ({ useQueryClient: () => ({}) }));
jest.mock('@/lib/api', () => ({
  updateSafeAddress: (...args: unknown[]) => mockUpdateSafeAddress(...args),
}));
jest.mock('@/lib/utils', () => ({
  withRefreshToken: (apiCall: () => Promise<unknown>) => apiCall(),
}));
jest.mock('@/hooks/useAnalytics', () => ({
  fetchIsDeposited: (...args: unknown[]) => mockFetchIsDeposited(...args),
}));
jest.mock('@/store/usePointsStore', () => ({
  usePointsStore: { getState: () => ({ fetchPoints: mockFetchPoints }) },
}));

const account: User = {
  userId: 'user-1',
  username: 'jess',
  safeAddress: '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed',
  signWith: '0x00000000000000000000000000000000000000a1',
  suborgId: 'sub-org-1',
  selected: true,
};

const runInit = async () => {
  const Probe = () => {
    usePostSignupInit(account);
    return null;
  };
  await act(async () => {
    create(<Probe />);
  });
  // The initialization runs in the background; let it finish.
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, 0));
  });
};

describe('usePostSignupInit', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useUserStore.setState({ users: [account], safeAddressSynced: {} });
    mockFetchIsDeposited.mockResolvedValue(0);
    mockFetchPoints.mockResolvedValue(undefined);
  });

  it('saves the Safe address, then loads the balance and points', async () => {
    mockUpdateSafeAddress.mockResolvedValue({ success: true });

    await runInit();

    expect(mockUpdateSafeAddress).toHaveBeenCalledWith(account.safeAddress);
    expect(useUserStore.getState().safeAddressSynced['user-1']).toBe(true);
    expect(mockFetchIsDeposited).toHaveBeenCalled();
    expect(mockFetchPoints).toHaveBeenCalled();
  });

  it('still loads the balance and points when the server already holds the address', async () => {
    mockUpdateSafeAddress.mockRejectedValue({ status: 409 });

    await runInit();

    expect(useUserStore.getState().safeAddressSynced['user-1']).toBe(true);
    expect(mockFetchIsDeposited).toHaveBeenCalled();
    expect(mockFetchPoints).toHaveBeenCalled();
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });

  it('leaves a refused save for the next launch, and loads the rest', async () => {
    mockUpdateSafeAddress.mockRejectedValue({ status: 403 });

    await runInit();

    expect(useUserStore.getState().safeAddressSynced['user-1']).toBeUndefined();
    expect(Sentry.captureException).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ tags: { type: 'safe_address_update_error_lazy' } }),
    );
    expect(mockFetchIsDeposited).toHaveBeenCalled();
    expect(mockFetchPoints).toHaveBeenCalled();
  });

  it('sends nothing for an account already marked synced', async () => {
    useUserStore.setState({ safeAddressSynced: { 'user-1': true } });

    await runInit();

    expect(mockUpdateSafeAddress).not.toHaveBeenCalled();
    expect(mockFetchIsDeposited).toHaveBeenCalled();
  });
});
