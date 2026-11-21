import { createWalletTopUpQuote, getWalletTopUpAvailability } from '@/lib/api';
import { WALLET_TOPUP_INVALID_RESPONSE, WalletTopUpRequestError } from '@/lib/walletTopUp';

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

/**
 * The top-up's network answers are untrusted: a 200 missing what the flow reads
 * fails in the request, through the error path the screens already handle,
 * instead of in a screen that reads the missing field.
 */

const originalFetch = global.fetch;
const mockFetch = jest.fn();
const respond = (body: unknown) =>
  mockFetch.mockResolvedValue({ ok: true, status: 200, json: async () => body });

beforeEach(() => {
  mockFetch.mockReset();
  global.fetch = mockFetch;
});
afterEach(() => {
  global.fetch = originalFetch;
});

const AVAILABILITY = {
  available: true,
  reason: 'ok',
  capabilityStatus: 'Active',
  sdk: { webEnvironment: 'uat', mobileEnvironment: 'test', clientId: null },
  provider: 'checkout',
  walletConfig: { apple_pay: {} },
  currencies: ['USD'],
  defaultCurrency: 'USD',
  limits: { USD: { min: '10.00', max: '500.00' } },
  payoutTokens: { USD: 'USDC' },
};

const QUOTE = {
  estimationId: 'est-1',
  provider: 'checkout',
  walletConfig: { apple_pay: {} },
  checkoutToken: 'token-1',
  checkoutTokenExpiresAt: 1_700_000_000,
  quote: {
    estimationId: 'est-1',
    sourceAmount: { amount: '101.50', currency: 'USD' },
    destinationAmount: { amount: '100.00', currency: 'USDC' },
    fee: null,
    rate: null,
    expiresAtMs: 1_700_000_000_000,
  },
  payout: { token: 'USDC', chainId: 8453, amount: '100.00' },
};

const QUOTE_REQUEST = {
  amount: '100.00',
  currency: 'USD',
  paymentMethod: 'apple_pay',
  platform: 'ios',
} as const;

describe('getWalletTopUpAvailability', () => {
  it('returns a complete answer unchanged', async () => {
    respond(AVAILABILITY);
    await expect(getWalletTopUpAvailability()).resolves.toEqual(AVAILABILITY);
  });

  it('fails a "yes" with no limits, so the row stays hidden', async () => {
    const { limits: _limits, ...incomplete } = AVAILABILITY;
    respond(incomplete);
    await expect(getWalletTopUpAvailability()).rejects.toMatchObject({
      code: WALLET_TOPUP_INVALID_RESPONSE,
    });
  });
});

describe('createWalletTopUpQuote', () => {
  it('returns a complete quote unchanged', async () => {
    respond(QUOTE);
    await expect(createWalletTopUpQuote(QUOTE_REQUEST)).resolves.toEqual(QUOTE);
  });

  it('fails a quote with nothing to review, before it reaches the store', async () => {
    respond({ ...QUOTE, quote: {} });
    const error = await createWalletTopUpQuote(QUOTE_REQUEST).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(WalletTopUpRequestError);
    expect(error).toMatchObject({ status: 200, code: WALLET_TOPUP_INVALID_RESPONSE });
  });

  it('fails a quote with no checkout token', async () => {
    const { checkoutToken: _token, ...incomplete } = QUOTE;
    respond(incomplete);
    await expect(createWalletTopUpQuote(QUOTE_REQUEST)).rejects.toBeInstanceOf(
      WalletTopUpRequestError,
    );
  });
});
