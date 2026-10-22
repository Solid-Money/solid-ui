import React from 'react';
import * as Sentry from '@sentry/react-native';

import { path } from '@/constants/path';
import useUser from '@/hooks/useUser';
import { User } from '@/lib/types';
import { useUserStore } from '@/store/useUserStore';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { act, create } = require('react-test-renderer');

/**
 * An account whose signup failed after the server created it reaches login
 * without a Safe address, and login saves the one it works out. On native that
 * request's JWT is read from the selected user in the store, so it has to be
 * sent after the account being logged into is stored: before, it went out with
 * no token (or another account's), was refused, and failed every login.
 */

const mockSafeAddress = '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed';
const mockReplace = jest.fn();
const mockStampGetWhoami = jest.fn();
const mockLogin = jest.fn();
const mockQueryClient = { clear: jest.fn() };

jest.mock('@sentry/react-native', () => ({
  addBreadcrumb: jest.fn(),
  captureException: jest.fn(),
  captureMessage: jest.fn(),
}));
// The stores persist through MMKV, which has no native module under jest.
jest.mock('@/lib/mmvkStorage', () => ({
  __esModule: true,
  default: () => ({
    setItem: jest.fn(),
    getItem: () => null,
    removeItem: jest.fn(),
  }),
}));
jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
// The API module registers interceptors at load; the request under test is a
// plain fetch, faked below.
jest.mock('axios', () => {
  const instance = {
    post: jest.fn(),
    get: jest.fn(),
    interceptors: { request: { use: jest.fn() }, response: { use: jest.fn() } },
  };
  const axios = { ...instance, create: () => instance };
  return { __esModule: true, default: axios, ...axios };
});
// The asset map pulls in reanimated, which has no native part under jest.
jest.mock('@/lib/assets', () => ({ getAsset: (asset: string) => asset }));
jest.mock('expo-router', () => ({ useRouter: () => ({ replace: mockReplace }) }));
jest.mock('@tanstack/react-query', () => ({
  ...jest.requireActual('@tanstack/react-query'),
  useQueryClient: () => mockQueryClient,
}));
jest.mock('@turnkey/react-native-wallet-kit', () => ({
  StamperType: { Passkey: 'passkey' },
  useTurnkey: () => ({
    httpClient: { stampGetWhoami: mockStampGetWhoami },
    createHttpClient: jest.fn(),
  }),
}));
// The Safe is worked out from the passkey wallet over our RPC; only its
// address matters here.
jest.mock('@turnkey/viem', () => ({
  createAccount: jest.fn(async () => ({
    sign: jest.fn(),
    signMessage: jest.fn(),
    signTypedData: jest.fn(),
    signTransaction: jest.fn(),
  })),
}));
jest.mock('permissionless/accounts', () => ({
  toSafeSmartAccount: jest.fn(async () => ({ address: mockSafeAddress })),
}));
jest.mock('permissionless', () => ({
  createSmartAccountClient: jest.fn(({ account }) => ({ account })),
}));
jest.mock('@/lib/pimlico', () => ({ pimlicoClient: jest.fn(() => ({})) }));
jest.mock('@/lib/wagmi', () => ({ publicClient: jest.fn() }));
jest.mock('@/lib/analytics', () => ({
  getAmplitudeDeviceId: jest.fn(),
  track: jest.fn(),
  trackIdentity: jest.fn(),
}));
jest.mock('@/lib/intercom', () => ({
  useIntercom: () => ({ boot: jest.fn(), shutdown: jest.fn() }),
}));
jest.mock('@/hooks/useAnalytics', () => ({ fetchIsDeposited: jest.fn(async () => 0) }));
jest.mock('@/store/usePointsStore', () => ({
  usePointsStore: {
    getState: () => ({ reset: jest.fn(), fetchPoints: jest.fn(async () => undefined) }),
  },
}));
jest.mock('@/store/useStoreReviewStore', () => ({
  useStoreReviewStore: { getState: () => ({ reset: jest.fn() }) },
}));
// Only the login call is faked: the Safe address is saved by the real request,
// which reads its JWT from the store exactly as the app does.
jest.mock('@/lib/api', () => ({
  ...jest.requireActual('@/lib/api'),
  login: (...args: unknown[]) => mockLogin(...args),
}));

const LOGIN_TOKENS = { accessToken: 'access-from-login', refreshToken: 'refresh-from-login' };

const loggedInAccount = (overrides: Record<string, unknown> = {}) => ({
  _id: 'user-1',
  username: 'jess',
  email: 'jess@example.com',
  subOrganizationId: 'sub-org-1',
  walletAddress: '0x00000000000000000000000000000000000000a1',
  credentialId: 'credential-1',
  tokens: LOGIN_TOKENS,
  ...overrides,
});

const otherAccount: User = {
  userId: 'user-2',
  username: 'someone-else',
  safeAddress: '0x00000000000000000000000000000000000000b2',
  walletAddress: '0x00000000000000000000000000000000000000b1',
  signWith: '0x00000000000000000000000000000000000000b1',
  suborgId: 'sub-org-2',
  selected: true,
  tokens: { accessToken: 'access-of-another-account', refreshToken: 'refresh-of-another' },
} as User;

let mockFetch: jest.Mock;

const respondToSave = (status: number) => {
  mockFetch.mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => ({ success: status < 300 }),
  });
};

/** The update-safe-address requests the login sent. */
const saveRequests = () =>
  mockFetch.mock.calls.filter(([url]) => String(url).endsWith('/auths/update-safe-address'));

const logIn = async () => {
  const seen: ReturnType<typeof useUser>[] = [];
  const Probe = () => {
    seen.push(useUser());
    return null;
  };
  await act(async () => {
    create(<Probe />);
  });
  await act(async () => {
    await seen[seen.length - 1].handleLogin();
  });
};

describe('login saves a missing Safe address', () => {
  let consoleSpies: jest.SpyInstance[] = [];

  beforeEach(() => {
    jest.clearAllMocks();
    consoleSpies = [
      jest.spyOn(console, 'warn').mockImplementation(() => {}),
      jest.spyOn(console, 'error').mockImplementation(() => {}),
    ];
    useUserStore.setState({ users: [], safeAddressSynced: {} });
    mockStampGetWhoami.mockResolvedValue({ stamp: {} });
    mockLogin.mockResolvedValue(loggedInAccount());
    mockFetch = jest.fn();
    global.fetch = mockFetch as unknown as typeof fetch;
    respondToSave(201);
  });

  afterEach(() => {
    consoleSpies.forEach(spy => spy.mockRestore());
  });

  it('sends it with the token this login issued', async () => {
    await logIn();

    expect(saveRequests()).toHaveLength(1);
    const [, init] = saveRequests()[0];
    expect(init.headers.Authorization).toBe('Bearer access-from-login');
    expect(JSON.parse(init.body)).toEqual({ safeAddress: mockSafeAddress });

    expect(useUserStore.getState().safeAddressSynced['user-1']).toBe(true);
    expect(useUserStore.getState().users.find(u => u.selected)).toMatchObject({
      userId: 'user-1',
      safeAddress: mockSafeAddress,
    });
    expect(mockReplace).toHaveBeenCalledWith(path.HOME);
  });

  it('never sends it with the token of an account already on the device', async () => {
    useUserStore.setState({ users: [otherAccount] });

    await logIn();

    const [, init] = saveRequests()[0];
    expect(init.headers.Authorization).toBe('Bearer access-from-login');
    expect(useUserStore.getState().users.find(u => u.selected)?.userId).toBe('user-1');
  });

  it('opens the account when the save fails, and leaves the save for the retry', async () => {
    respondToSave(500);

    await logIn();

    expect(mockReplace).toHaveBeenCalledWith(path.HOME);
    // Not marked synced, so usePostSignupInit sends it again once the app loads.
    expect(useUserStore.getState().safeAddressSynced['user-1']).toBeUndefined();
    expect(Sentry.captureException).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ tags: { type: 'safe_address_update_error' } }),
    );
  });

  it('keeps the session when the save is refused and the refresh fails too', async () => {
    // The refresh failing would end the session through the global logout
    // handler — unselecting the account this login has just stored, while the
    // login itself went on to report success and open the app.
    mockFetch.mockImplementation(async (url: string) => ({
      ok: false,
      status: 401,
      json: async () => ({}),
      url,
    }));

    await logIn();

    expect(saveRequests()).toHaveLength(1);
    expect(useUserStore.getState().users.find(u => u.selected)?.userId).toBe('user-1');
    expect(useUserStore.getState().safeAddressSynced['user-1']).toBeUndefined();
    expect(mockReplace).toHaveBeenCalledTimes(1);
    expect(mockReplace).toHaveBeenCalledWith(path.HOME);
  });

  it('takes a 409 to mean the server already holds one', async () => {
    respondToSave(409);

    await logIn();

    expect(useUserStore.getState().safeAddressSynced['user-1']).toBe(true);
    expect(mockReplace).toHaveBeenCalledWith(path.HOME);
  });

  it('sends nothing when the account already has one', async () => {
    mockLogin.mockResolvedValue(loggedInAccount({ safeAddress: mockSafeAddress }));

    await logIn();

    expect(saveRequests()).toHaveLength(0);
    expect(mockReplace).toHaveBeenCalledWith(path.HOME);
  });
});
