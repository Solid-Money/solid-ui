import { getTransfiProhibitedCountries } from '@/lib/api';
import { FetchTimeoutError } from '@/lib/fetchWithTimeout';

jest.mock('@/constants/rewards', () => ({ MOCK_REWARDS_USER_DATA: {}, MOCK_TIER_BENEFITS: {} }));
jest.mock('@/store/useUserStore', () => ({ useUserStore: { getState: () => ({ users: [] }) } }));
jest.mock('@sentry/react-native', () => ({
  addBreadcrumb: jest.fn(),
  captureException: jest.fn(),
  captureMessage: jest.fn(),
}));
jest.mock('axios', () => {
  const instance = {
    post: jest.fn(),
    get: jest.fn(),
    interceptors: { request: { use: jest.fn() }, response: { use: jest.fn() } },
  };
  const axios = { ...instance, create: () => instance };
  return { __esModule: true, default: axios, ...axios };
});

const originalFetch = global.fetch;
const mockFetch = jest.fn();
beforeEach(() => {
  mockFetch.mockReset();
  global.fetch = mockFetch;
});
afterEach(() => {
  global.fetch = originalFetch;
  jest.useRealTimers();
});

const answer = (body: unknown) => ({ ok: true, status: 200, json: async () => body });

/**
 * The dashboard's TransFi list only ever adds restrictions, so anything short
 * of a well-formed answer has to fail the read — the caller then keeps the
 * build's list — rather than read as "nothing closed".
 */
describe('getTransfiProhibitedCountries', () => {
  it('returns the codes, dropping anything that is not one', async () => {
    mockFetch.mockResolvedValue(answer({ prohibitedCountries: ['TR', 7, null, 'ID'] }));

    await expect(getTransfiProhibitedCountries()).resolves.toEqual({
      prohibitedCountries: ['TR', 'ID'],
    });
  });

  it.each([{}, { prohibitedCountries: null }, { prohibitedCountries: 'TR' }, null])(
    'fails the read on a malformed answer (%p)',
    async body => {
      mockFetch.mockResolvedValue(answer(body));

      await expect(getTransfiProhibitedCountries()).rejects.toThrow('Malformed');
    },
  );

  it('fails the read on an HTTP error', async () => {
    const response = { ok: false, status: 404 };
    mockFetch.mockResolvedValue(response);

    await expect(getTransfiProhibitedCountries()).rejects.toBe(response);
  });

  it('times out a request that never answers', async () => {
    jest.useFakeTimers();
    mockFetch.mockImplementation(
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => reject(new Error('aborted')));
        }),
    );

    const pending = getTransfiProhibitedCountries();
    jest.advanceTimersByTime(10_000);

    await expect(pending).rejects.toBeInstanceOf(FetchTimeoutError);
  });
});
