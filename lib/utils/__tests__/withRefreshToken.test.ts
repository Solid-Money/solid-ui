const mockRefreshToken = jest.fn();

jest.mock('react-native', () => ({ Platform: { OS: 'web' } }));
jest.mock('@react-native-async-storage/async-storage', () => ({}));
jest.mock('@/constants/bridge', () => ({}));
jest.mock('@/lib/api', () => ({ refreshToken: () => mockRefreshToken() }));
jest.mock('@/lib/config', () => ({ ADDRESSES: {} }));
jest.mock('@/store/useUserStore', () => ({ useUserStore: { getState: () => ({}) } }));

/** fetch Responses are thrown as-is, so tests reject with status-bearing objects. */
const httpError = (status: number, headers: Record<string, string> = {}) => ({
  status,
  headers: { get: (name: string) => headers[name] ?? null },
});

const tokensResponse = () => ({ json: async () => ({ tokens: { accessToken: 'a' } }) });

let utils: typeof import('@/lib/utils/utils');
let logout: jest.Mock;
let now: number;

beforeEach(() => {
  jest.resetModules();
  mockRefreshToken.mockReset();
  now = 1_000_000;
  jest.spyOn(Date, 'now').mockImplementation(() => now);
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  // A fresh module per test resets the backoff state held at module scope.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  utils = require('@/lib/utils/utils');
  logout = jest.fn();
  utils.setGlobalLogoutHandler(logout);
});

afterEach(() => jest.restoreAllMocks());

const unauthorizedCall = () => jest.fn().mockRejectedValue(httpError(401));

describe('withRefreshToken', () => {
  it('logs out when refresh-token says the session does not exist (404)', async () => {
    mockRefreshToken.mockRejectedValue(httpError(404));

    await expect(utils.withRefreshToken(unauthorizedCall())).rejects.toMatchObject({
      status: 404,
    });
    expect(logout).toHaveBeenCalledTimes(1);
  });

  it('does not log out on 429, and stops calling refresh-token during the backoff', async () => {
    mockRefreshToken.mockRejectedValue(httpError(429));

    await expect(utils.withRefreshToken(unauthorizedCall())).rejects.toMatchObject({
      status: 429,
    });
    expect(logout).not.toHaveBeenCalled();
    expect(mockRefreshToken).toHaveBeenCalledTimes(1);

    // Further 401s inside the window surface the 401 without a refresh attempt.
    now += 59_000;
    await expect(utils.withRefreshToken(unauthorizedCall())).rejects.toMatchObject({
      status: 401,
    });
    expect(mockRefreshToken).toHaveBeenCalledTimes(1);

    now += 2_000;
    await expect(utils.withRefreshToken(unauthorizedCall())).rejects.toMatchObject({
      status: 429,
    });
    expect(mockRefreshToken).toHaveBeenCalledTimes(2);
  });

  it('doubles the backoff on consecutive 429s and resets it after a successful refresh', async () => {
    mockRefreshToken.mockRejectedValue(httpError(429));
    await utils.withRefreshToken(unauthorizedCall()).catch(() => {});
    now += 60_000;
    await utils.withRefreshToken(unauthorizedCall()).catch(() => {});
    expect(mockRefreshToken).toHaveBeenCalledTimes(2);

    // Second strike waits 120s.
    now += 119_000;
    await utils.withRefreshToken(unauthorizedCall()).catch(() => {});
    expect(mockRefreshToken).toHaveBeenCalledTimes(2);

    now += 1_000;
    mockRefreshToken.mockResolvedValue(tokensResponse());
    const call = jest.fn().mockRejectedValueOnce(httpError(401)).mockResolvedValue('ok');
    await expect(utils.withRefreshToken(call)).resolves.toBe('ok');

    // Back to a 60s window after the success.
    mockRefreshToken.mockRejectedValue(httpError(429));
    await utils.withRefreshToken(unauthorizedCall()).catch(() => {});
    now += 60_000;
    await utils.withRefreshToken(unauthorizedCall()).catch(() => {});
    expect(mockRefreshToken).toHaveBeenCalledTimes(5);
  });

  it('honours a Retry-After longer than the backoff', async () => {
    mockRefreshToken.mockRejectedValue(httpError(429, { 'Retry-After': '90' }));
    await utils.withRefreshToken(unauthorizedCall()).catch(() => {});

    now += 89_000;
    await utils.withRefreshToken(unauthorizedCall()).catch(() => {});
    expect(mockRefreshToken).toHaveBeenCalledTimes(1);

    now += 1_000;
    await utils.withRefreshToken(unauthorizedCall()).catch(() => {});
    expect(mockRefreshToken).toHaveBeenCalledTimes(2);
  });

  it('counts one strike when concurrent callers share the rate-limited refresh', async () => {
    mockRefreshToken.mockRejectedValue(httpError(429));
    await Promise.allSettled([
      utils.withRefreshToken(unauthorizedCall()),
      utils.withRefreshToken(unauthorizedCall()),
      utils.withRefreshToken(unauthorizedCall()),
    ]);
    expect(mockRefreshToken).toHaveBeenCalledTimes(1);

    // One strike → 60s, not 240s.
    now += 60_000;
    await utils.withRefreshToken(unauthorizedCall()).catch(() => {});
    expect(mockRefreshToken).toHaveBeenCalledTimes(2);
  });
});
