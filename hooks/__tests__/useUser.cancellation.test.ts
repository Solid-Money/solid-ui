/**
 * Tests that user-cancellation signals from both iOS (NotAllowedError) and
 * Android (UserCancelled) are captured as Sentry warnings, not exceptions.
 */

import React from 'react';

// react-test-renderer is supplied by jest-expo without bundled declarations.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { act, create } = require('react-test-renderer');

// ── Sentry mock ──────────────────────────────────────────────────────────────
const mockCaptureException = jest.fn();
const mockCaptureMessage = jest.fn();
jest.mock('@sentry/react-native', () => ({
  captureException: (...args: any[]) => mockCaptureException(...args),
  captureMessage: (...args: any[]) => mockCaptureMessage(...args),
}));

// ── Turnkey mock (controls stampGetWhoami behaviour) ─────────────────────────
const mockStampGetWhoami = jest.fn();
jest.mock('@turnkey/react-native-wallet-kit', () => ({
  StamperType: { Passkey: 'passkey' },
  useTurnkey: () => ({
    httpClient: { stampGetWhoami: mockStampGetWhoami },
    createHttpClient: jest.fn().mockReturnValue({ stampGetWhoami: mockStampGetWhoami }),
  }),
}));

// ── Router ───────────────────────────────────────────────────────────────────
jest.mock('expo-router', () => ({ useRouter: () => ({ replace: jest.fn() }) }));

// ── React-Query ───────────────────────────────────────────────────────────────
jest.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ clear: jest.fn(), invalidateQueries: jest.fn() }),
}));

// ── Zustand stores ────────────────────────────────────────────────────────────
jest.mock('@/store/useUserStore', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { create } = require('zustand');
  const store = create(() => ({
    users: [],
    user: undefined,
    storeUser: jest.fn(),
    updateUser: jest.fn(),
    selectUserById: jest.fn(),
    unselectUser: jest.fn(),
    removeUsers: jest.fn(),
    setSignupInfo: jest.fn(),
    setLoginInfo: jest.fn(),
    setSignupUser: jest.fn(),
    markSafeAddressSynced: jest.fn(),
    redirectFrom: null,
    setRedirectFrom: jest.fn(),
  }));
  store.getState = store.getState.bind(store);
  return { useUserStore: store };
});

jest.mock('@/store/useKycStore', () => ({
  useKycStore: (sel: any) => sel({ clearKycLinkId: jest.fn() }),
}));
jest.mock('@/store/useActivityStore', () => ({
  useActivityStore: (sel: any) => sel({ removeEvents: jest.fn() }),
}));
jest.mock('@/store/useBalanceStore', () => ({
  useBalanceStore: (sel: any) => sel({ clearBalance: jest.fn() }),
}));
jest.mock('@/store/usePointsStore', () => ({
  usePointsStore: { getState: () => ({ reset: jest.fn(), fetchPoints: jest.fn() }) },
}));
jest.mock('@/store/useStoreReviewStore', () => ({
  useStoreReviewStore: { getState: () => ({ reset: jest.fn() }) },
}));
jest.mock('@/store/useAttributionStore', () => ({
  useAttributionStore: { getState: () => ({ getAttributionForEvent: () => ({}) }) },
}));
jest.mock('@/store/useRewardsUpgradeStore', () => ({
  useRewardsUpgradeStore: { getState: () => ({}) },
}));

// ── Analytics / lib helpers ───────────────────────────────────────────────────
jest.mock('@/lib/analytics', () => ({
  getAmplitudeDeviceId: () => 'test-device',
  track: jest.fn(),
  trackIdentity: jest.fn(),
}));
jest.mock('@/lib/intercom', () => ({ useIntercom: () => ({}) }));
jest.mock('@/lib/attribution', () => ({ getAttributionChannel: () => 'organic' }));
jest.mock('@/lib/utils', () => ({
  setIsLoggingOut: jest.fn(),
  setGlobalLogoutHandler: jest.fn(),
  getNonce: jest.fn().mockResolvedValue('0'),
  isPasskeyPromptError: jest.fn().mockReturnValue(false),
  mergeCredentialIds: jest.fn().mockReturnValue([]),
  parseStampHeaderValueCredentialId: jest.fn().mockReturnValue('cred-id'),
  withRefreshToken: (fn: any) => fn(),
}));
jest.mock('@/hooks/useAnalytics', () => ({ fetchIsDeposited: jest.fn().mockResolvedValue(0) }));

// ── Config ────────────────────────────────────────────────────────────────────
jest.mock('@/lib/config', () => ({
  EXPO_PUBLIC_TURNKEY_ORGANIZATION_ID: 'test-org',
  USER: { pimlicoUrl: () => 'http://pimlico' },
}));

// ── Viem / wagmi / pimlico / API (not exercised in cancellation path) ─────────
jest.mock('@/lib/wagmi', () => ({ publicClient: jest.fn() }));
jest.mock('@/lib/pimlico', () => ({ pimlicoClient: jest.fn() }));
jest.mock('@/lib/api', () => ({
  login: jest.fn(),
  logout: jest.fn(),
  removePushToken: jest.fn(),
  deleteAccount: jest.fn(),
  updateSafeAddress: jest.fn(),
  updateUserCredentialId: jest.fn(),
}));
jest.mock('viem', () => ({ http: jest.fn(), hashTypedData: jest.fn() }));
jest.mock('viem/chains', () => ({ mainnet: { id: 1 } }));
jest.mock('viem/account-abstraction', () => ({ entryPoint07Address: '0x' }));
jest.mock('permissionless', () => ({ createSmartAccountClient: jest.fn() }));
jest.mock('permissionless/accounts', () => ({ toSafeSmartAccount: jest.fn() }));
jest.mock('@turnkey/viem', () => ({ createAccount: jest.fn() }));
jest.mock('@/lib/onramper', () => ({ destroyOnramper: jest.fn() }));
// Don't mock react-native wholesale – jest-expo already sets it up.
// Just override Platform.OS so the hook sees android.
jest.mock('react-native', () => {
  const rn = jest.requireActual('react-native');
  Object.defineProperty(rn.Platform, 'OS', { get: () => 'android' });
  return rn;
});

// ── Subject under test ────────────────────────────────────────────────────────
import useUser from '@/hooks/useUser';

// Helper: renders the hook inside a minimal functional component and returns
// a ref to the latest hook return value.
function renderUseUser() {
  let result: ReturnType<typeof useUser> | undefined;
  function Harness() {
    result = useUser();
    return null;
  }
  let renderer: any;
  act(() => {
    renderer = create(React.createElement(Harness));
  });
  return {
    get current() {
      return result!;
    },
    renderer,
  };
}

// ─────────────────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
});

describe('handleLogin – user cancellation', () => {
  it('captures a WARNING (not an exception) when iOS throws NotAllowedError', async () => {
    const iosError = Object.assign(new Error('User cancelled'), { name: 'NotAllowedError' });
    mockStampGetWhoami.mockRejectedValueOnce(iosError);

    const hook = renderUseUser();
    await act(async () => {
      await hook.current.handleLogin();
    });

    expect(mockCaptureMessage).toHaveBeenCalledWith(
      'User cancelled login',
      expect.objectContaining({ level: 'warning' }),
    );
    // Should NOT fire captureException for the "Error logging in" path
    const exceptionCalls: any[][] = mockCaptureException.mock.calls;
    const loginInExceptionCall = exceptionCalls.some(
      args => args[0] instanceof Error && args[0].message === 'Error logging in',
    );
    expect(loginInExceptionCall).toBe(false);
  });

  it('captures a WARNING (not an exception) when Android returns UserCancelled', async () => {
    const androidError = { error: 'UserCancelled', message: 'The user cancelled the request.' };
    mockStampGetWhoami.mockRejectedValueOnce(androidError);

    const hook = renderUseUser();
    await act(async () => {
      await hook.current.handleLogin();
    });

    expect(mockCaptureMessage).toHaveBeenCalledWith(
      'User cancelled login',
      expect.objectContaining({ level: 'warning' }),
    );
    const exceptionCalls: any[][] = mockCaptureException.mock.calls;
    const loginInExceptionCall = exceptionCalls.some(
      args => args[0] instanceof Error && args[0].message === 'Error logging in',
    );
    expect(loginInExceptionCall).toBe(false);
  });

  it('captures an EXCEPTION for genuine errors (not cancellations)', async () => {
    const networkError = new Error('Network request timed out');
    mockStampGetWhoami.mockRejectedValueOnce(networkError);

    const hook = renderUseUser();
    await act(async () => {
      await hook.current.handleLogin();
    });

    const exceptionCalls: any[][] = mockCaptureException.mock.calls;
    const loginInExceptionCall = exceptionCalls.some(
      args => args[0] instanceof Error && args[0].message === 'Error logging in',
    );
    expect(loginInExceptionCall).toBe(true);
    expect(mockCaptureMessage).not.toHaveBeenCalled();
  });
});
