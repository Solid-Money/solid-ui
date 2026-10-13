/// <reference types="jest" />

import { refreshToken } from '@/lib/api';
import {
  ensureFreshAccessToken,
  getJwtExpiryMs,
  refreshSessionTokens,
  withRefreshToken,
} from '@/lib/utils/utils';
import { useUserStore } from '@/store/useUserStore';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

jest.mock('@/lib/mmvkStorage', () => () => ({
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
}));

jest.mock('@/lib/api', () => ({ refreshToken: jest.fn() }));

const mockRefreshToken = refreshToken as jest.MockedFunction<typeof refreshToken>;

const BASE_TIME = Date.parse('2026-10-13T08:00:00Z');
let testIndex = 0;

beforeEach(() => {
  // Each test starts well past the previous one's proactive-refresh spacing.
  jest.useFakeTimers({ now: BASE_TIME + testIndex++ * 3_600_000 });
});

afterEach(() => {
  jest.useRealTimers();
});

const base64url = (value: object) =>
  Buffer.from(JSON.stringify(value))
    .toString('base64')
    .replace(/=+$/, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
const jwt = (expSeconds: number, iatSeconds?: number) =>
  `${base64url({ alg: 'HS256', typ: 'JWT' })}.${base64url({ sub: 'u1', exp: expSeconds, iat: iatSeconds })}.sig`;

const nowSeconds = () => Math.floor(Date.now() / 1000);

const signIn = (accessToken: string, refresh = 'refresh-1') =>
  useUserStore.setState({
    users: [
      {
        userId: 'u1',
        username: 'mark',
        selected: true,
        tokens: { accessToken, refreshToken: refresh },
      } as never,
    ],
  });

const storedTokens = () => useUserStore.getState().users[0]?.tokens;

const refreshResponse = (accessToken: string, refresh: string) =>
  ({ json: async () => ({ tokens: { accessToken, refreshToken: refresh } }) }) as Response;

beforeEach(() => {
  mockRefreshToken.mockReset();
});

describe('getJwtExpiryMs', () => {
  it('reads exp from a base64url payload', () => {
    expect(getJwtExpiryMs(jwt(1_800_000_000))).toBe(1_800_000_000_000);
  });

  it('returns null for anything it cannot read', () => {
    expect(getJwtExpiryMs('not-a-jwt')).toBeNull();
    expect(getJwtExpiryMs('a.%%%.c')).toBeNull();
    expect(getJwtExpiryMs(`${base64url({})}.${base64url({ sub: 'u1' })}.sig`)).toBeNull();
  });
});

describe('ensureFreshAccessToken', () => {
  it('leaves a token with time to spare alone', async () => {
    signIn(jwt(nowSeconds() + 30 * 60));
    await ensureFreshAccessToken();
    expect(mockRefreshToken).not.toHaveBeenCalled();
  });

  it('refreshes once for a whole burst of callers and saves the new tokens', async () => {
    signIn(jwt(nowSeconds() - 10));
    const fresh = jwt(nowSeconds() + 3600);
    mockRefreshToken.mockResolvedValue(refreshResponse(fresh, 'refresh-2'));

    await Promise.all([
      ensureFreshAccessToken(),
      ensureFreshAccessToken(),
      ensureFreshAccessToken(),
    ]);

    expect(mockRefreshToken).toHaveBeenCalledTimes(1);
    expect(storedTokens()).toEqual({ accessToken: fresh, refreshToken: 'refresh-2' });
  });

  it('refreshes a token that is about to expire', async () => {
    signIn(jwt(nowSeconds() + 20));
    mockRefreshToken.mockResolvedValue(refreshResponse(jwt(nowSeconds() + 3600), 'refresh-2'));
    await ensureFreshAccessToken();
    expect(mockRefreshToken).toHaveBeenCalledTimes(1);
  });

  it('never throws, and leaves the tokens as they were when the refresh fails', async () => {
    const expired = jwt(nowSeconds() - 10);
    signIn(expired);
    mockRefreshToken.mockRejectedValue({ status: 401 });

    await expect(ensureFreshAccessToken()).resolves.toBeUndefined();
    expect(storedTokens()?.accessToken).toBe(expired);
  });

  it('does nothing without a signed-in session', async () => {
    useUserStore.setState({ users: [] });
    await ensureFreshAccessToken();
    expect(mockRefreshToken).not.toHaveBeenCalled();
  });
});

describe('withRefreshToken', () => {
  it('sends the request once, with the renewed token, instead of failing with 401 first', async () => {
    signIn(jwt(nowSeconds() - 10));
    const fresh = jwt(nowSeconds() + 3600);
    mockRefreshToken.mockResolvedValue(refreshResponse(fresh, 'refresh-2'));

    const seenTokens: (string | undefined)[] = [];
    const apiCall = jest.fn(async () => {
      seenTokens.push(storedTokens()?.accessToken);
      return 'ok';
    });

    await expect(withRefreshToken(apiCall)).resolves.toBe('ok');
    expect(apiCall).toHaveBeenCalledTimes(1);
    expect(seenTokens).toEqual([fresh]);
  });

  it('a refresh that starts right after another one sends the rotated refresh token', async () => {
    signIn(jwt(nowSeconds() - 10), 'refresh-1');
    mockRefreshToken.mockImplementation(async () => {
      // The value the request carries is whatever is stored when it is sent.
      const sent = storedTokens()?.refreshToken;
      return refreshResponse(jwt(nowSeconds() - 10), `${sent}-rotated`);
    });

    await refreshSessionTokens();
    await refreshSessionTokens();

    expect(mockRefreshToken).toHaveBeenCalledTimes(2);
    expect(storedTokens()?.refreshToken).toBe('refresh-1-rotated-rotated');
  });
});

describe('a device clock that is off', () => {
  it('judges expiry on the server clock once a refresh has shown the offset', async () => {
    const serverNow = () => nowSeconds() - 2 * 3600; // the phone runs two hours fast
    signIn(jwt(serverNow() - 10, serverNow() - 3600));
    mockRefreshToken.mockImplementation(async () =>
      refreshResponse(jwt(serverNow() + 3600, serverNow()), 'refresh-2'),
    );

    await ensureFreshAccessToken();
    expect(mockRefreshToken).toHaveBeenCalledTimes(1);

    // The new token looks long expired to this phone; it is not.
    jest.advanceTimersByTime(60_000);
    await ensureFreshAccessToken();
    await withRefreshToken(async () => 'ok');
    expect(mockRefreshToken).toHaveBeenCalledTimes(1);
  });

  it('never makes a request wait long for a refresh that hangs', async () => {
    signIn(jwt(nowSeconds() - 10));
    mockRefreshToken.mockImplementation(() => new Promise(() => {}));

    const pending = withRefreshToken(async () => 'ok');
    await jest.advanceTimersByTimeAsync(8_000);
    await expect(pending).resolves.toBe('ok');
  });
});
