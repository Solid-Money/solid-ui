import { getWalletEligibility } from '@/lib/api';

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
});

it('returns eligibility from a successful card check', async () => {
  const eligibility = { eligible: true, alreadyInAppleWallet: true };
  mockFetch.mockResolvedValue({ ok: true, status: 200, json: async () => eligibility });
  await expect(getWalletEligibility()).resolves.toEqual(eligibility);
});

it('returns an empty result for the expected Card not found response', async () => {
  mockFetch.mockResolvedValue({ ok: false, status: 404 });
  await expect(getWalletEligibility()).resolves.toBeNull();
});

it.each([401, 403, 500])(
  'preserves HTTP %s for authentication and failure handling',
  async status => {
    const response = { ok: false, status };
    mockFetch.mockResolvedValue(response);
    await expect(getWalletEligibility()).rejects.toBe(response);
  },
);
