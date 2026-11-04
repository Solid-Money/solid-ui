const mockRefreshToken = jest.fn();

jest.mock('react-native', () => ({ Platform: { OS: 'web' } }));
jest.mock('@react-native-async-storage/async-storage', () => ({}));
jest.mock('@/constants/bridge', () => ({}));
jest.mock('@/lib/api', () => ({ refreshToken: () => mockRefreshToken() }));
jest.mock('@/lib/config', () => ({ ADDRESSES: {} }));
jest.mock('@/store/useUserStore', () => ({ useUserStore: { getState: () => ({}) } }));

/** What the backend answers for any request from a suspended account. */
const suspendedError = () => ({
  status: 403,
  statusCode: 403,
  code: 'ACCOUNT_SUSPENDED',
  message: 'This account is suspended. Contact support.',
});

const httpError = (status: number) => ({
  status,
  headers: { get: () => null },
});

let utils: typeof import('@/lib/utils/utils');
let logout: jest.Mock;
let suspended: jest.Mock;

beforeEach(() => {
  jest.resetModules();
  mockRefreshToken.mockReset();
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  utils = require('@/lib/utils/utils');
  logout = jest.fn();
  suspended = jest.fn();
  utils.setGlobalLogoutHandler(logout);
  utils.setGlobalSuspendedHandler(suspended);
});

afterEach(() => jest.restoreAllMocks());

describe('withRefreshToken — suspended accounts', () => {
  it('ends the session as suspended when a request is refused, without trying a refresh', async () => {
    const call = jest.fn().mockRejectedValue(suspendedError());

    await expect(utils.withRefreshToken(call)).rejects.toMatchObject({
      code: 'ACCOUNT_SUSPENDED',
    });
    expect(suspended).toHaveBeenCalledTimes(1);
    expect(logout).not.toHaveBeenCalled();
    expect(mockRefreshToken).not.toHaveBeenCalled();
  });

  it('recognises the refusal on an axios error', async () => {
    const call = jest.fn().mockRejectedValue({
      response: { status: 403, data: { code: 'ACCOUNT_SUSPENDED' } },
    });

    await expect(utils.withRefreshToken(call)).rejects.toBeTruthy();
    expect(suspended).toHaveBeenCalledTimes(1);
  });

  it('ends the session as suspended when the refresh is what refuses it', async () => {
    mockRefreshToken.mockRejectedValue(suspendedError());
    const call = jest.fn().mockRejectedValue(httpError(401));

    await expect(utils.withRefreshToken(call)).rejects.toMatchObject({ status: 403 });
    expect(suspended).toHaveBeenCalledTimes(1);
    expect(logout).not.toHaveBeenCalled();
  });

  it('ends the session as suspended when the retry after a refresh is refused', async () => {
    // Suspended between the refresh and the retry.
    mockRefreshToken.mockResolvedValue({ json: async () => ({ tokens: {} }) });
    const call = jest
      .fn()
      .mockRejectedValueOnce(httpError(401))
      .mockRejectedValueOnce(suspendedError());

    await expect(utils.withRefreshToken(call)).rejects.toMatchObject({
      code: 'ACCOUNT_SUSPENDED',
    });
    expect(call).toHaveBeenCalledTimes(2);
    expect(mockRefreshToken).toHaveBeenCalledTimes(1);
    expect(suspended).toHaveBeenCalledTimes(1);
    expect(logout).not.toHaveBeenCalled();
  });

  it('passes any other retry failure through untouched, without refreshing again', async () => {
    mockRefreshToken.mockResolvedValue({ json: async () => ({ tokens: {} }) });
    const call = jest
      .fn()
      .mockRejectedValueOnce(httpError(401))
      .mockRejectedValueOnce(httpError(500));

    await expect(utils.withRefreshToken(call)).rejects.toMatchObject({ status: 500 });
    expect(mockRefreshToken).toHaveBeenCalledTimes(1);
    expect(suspended).not.toHaveBeenCalled();
    expect(logout).not.toHaveBeenCalled();
  });

  it('reads the code off an unread fetch Response', async () => {
    if (typeof Response === 'undefined') return;
    mockRefreshToken.mockRejectedValue(
      new Response(JSON.stringify({ statusCode: 403, code: 'ACCOUNT_SUSPENDED' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    const call = jest.fn().mockRejectedValue(httpError(401));

    const error = await utils.withRefreshToken(call).catch((e: unknown) => e);
    expect(suspended).toHaveBeenCalledTimes(1);
    // Read from a clone: the body is still there for whoever handles it next.
    await expect((error as Response).json()).resolves.toMatchObject({
      code: 'ACCOUNT_SUSPENDED',
    });
  });

  it('treats any other 403 as before: thrown, no suspension, no logout', async () => {
    const call = jest.fn().mockRejectedValue({ status: 403, code: 'CARD_FROZEN_BY_SOLID' });

    await expect(utils.withRefreshToken(call)).rejects.toMatchObject({ status: 403 });
    expect(suspended).not.toHaveBeenCalled();
    expect(logout).not.toHaveBeenCalled();
  });

  it('still logs out on a plain refused refresh', async () => {
    mockRefreshToken.mockRejectedValue(httpError(403));
    const call = jest.fn().mockRejectedValue(httpError(401));

    await expect(utils.withRefreshToken(call)).rejects.toMatchObject({ status: 403 });
    expect(logout).toHaveBeenCalledTimes(1);
    expect(suspended).not.toHaveBeenCalled();
  });

  it('does nothing more once a logout is already under way', async () => {
    utils.setIsLoggingOut(true);
    const call = jest.fn().mockRejectedValue(suspendedError());

    await expect(utils.withRefreshToken(call)).rejects.toBeTruthy();
    expect(suspended).not.toHaveBeenCalled();
  });
});
