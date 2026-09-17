import { ALCHEMY_PRICE_BATCH_SIZE } from '@/constants/alchemy';

// Pulled in only for mock-mode payloads, and it reaches Reanimated through the
// asset registry, which has no native side under Jest.
jest.mock('@/constants/rewards', () => ({
  MOCK_REWARDS_USER_DATA: {},
  MOCK_TIER_BENEFITS: {},
}));
// Reached for the JWT the price lookup deliberately does not send; the store
// itself sits on native MMKV.
jest.mock('@/store/useUserStore', () => ({
  useUserStore: { getState: () => ({ users: [] }) },
}));
jest.mock('@sentry/react-native', () => ({
  addBreadcrumb: jest.fn(),
  captureException: jest.fn(),
  captureMessage: jest.fn(),
}));

// lib/api.ts builds a dedicated `axios.create()` instance for calls that must
// not carry the Solid JWT; that instance is what the price lookup posts through.
// One shared stub backs both it and the module-level axios.
jest.mock('axios', () => {
  const instance = {
    post: jest.fn(),
    get: jest.fn(),
    interceptors: { request: { use: jest.fn() }, response: { use: jest.fn() } },
  };
  const axios = { ...instance, create: () => instance };
  return { __esModule: true, default: axios, ...axios };
});

/* eslint-disable @typescript-eslint/no-require-imports */
const post = (require('axios') as { default: { post: jest.Mock } }).default.post;
const { fetchTokenPricesByAddress } = require('@/lib/api') as typeof import('@/lib/api');
/* eslint-enable @typescript-eslint/no-require-imports */

const USDC_BASE = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const FUSE_BASE = '0x01FaCC69ec7360640Aa5898e852326752801674a';
const USDC_ETHEREUM = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';

const priced = (network: string, address: string, value: string) => ({
  network,
  address,
  prices: [{ currency: 'usd', value, lastUpdatedAt: '2026-09-09T00:00:00Z' }],
});

beforeEach(() => post.mockReset());

describe('fetchTokenPricesByAddress', () => {
  it('keys prices by chain id and lowercased address', async () => {
    post.mockResolvedValue({
      data: {
        data: [
          priced('base-mainnet', FUSE_BASE.toLowerCase(), '0.00469465'),
          priced('eth-mainnet', USDC_ETHEREUM.toLowerCase(), '0.9998'),
        ],
      },
    });

    const prices = await fetchTokenPricesByAddress([
      { chainId: 8453, address: FUSE_BASE },
      { chainId: 1, address: USDC_ETHEREUM },
    ]);

    expect(prices).toEqual({
      [`8453:${FUSE_BASE.toLowerCase()}`]: 0.00469465,
      [`1:${USDC_ETHEREUM.toLowerCase()}`]: 0.9998,
    });
  });

  it('sends one request carrying each token as a network/address pair', async () => {
    post.mockResolvedValue({ data: { data: [] } });

    await fetchTokenPricesByAddress([
      { chainId: 8453, address: FUSE_BASE },
      { chainId: 1, address: USDC_ETHEREUM },
    ]);

    expect(post).toHaveBeenCalledTimes(1);
    expect(post.mock.calls[0][0]).toContain('/tokens/by-address');
    expect(post.mock.calls[0][1]).toEqual({
      addresses: [
        { network: 'base-mainnet', address: FUSE_BASE.toLowerCase() },
        { network: 'eth-mainnet', address: USDC_ETHEREUM.toLowerCase() },
      ],
    });
  });

  it('deduplicates the same token on the same chain', async () => {
    post.mockResolvedValue({ data: { data: [] } });

    await fetchTokenPricesByAddress([
      { chainId: 8453, address: USDC_BASE },
      { chainId: 8453, address: USDC_BASE.toLowerCase() },
    ]);

    expect(post.mock.calls[0][1].addresses).toHaveLength(1);
  });

  it('keeps the same address on two chains apart', async () => {
    post.mockResolvedValue({
      data: {
        data: [
          priced('base-mainnet', USDC_BASE.toLowerCase(), '1.0001'),
          priced('eth-mainnet', USDC_BASE.toLowerCase(), '0.42'),
        ],
      },
    });

    const prices = await fetchTokenPricesByAddress([
      { chainId: 8453, address: USDC_BASE },
      { chainId: 1, address: USDC_BASE },
    ]);

    expect(prices[`8453:${USDC_BASE.toLowerCase()}`]).toBe(1.0001);
    expect(prices[`1:${USDC_BASE.toLowerCase()}`]).toBe(0.42);
  });

  it('chunks past the per-request address cap and merges the batches', async () => {
    const tokens = Array.from({ length: ALCHEMY_PRICE_BATCH_SIZE + 3 }, (_, i) => ({
      chainId: 8453,
      address: `0x${(i + 1).toString(16).padStart(40, '0')}`,
    }));
    post.mockImplementation((_url: string, body: { addresses: { address: string }[] }) =>
      Promise.resolve({
        data: { data: body.addresses.map(a => priced('base-mainnet', a.address, '2')) },
      }),
    );

    const prices = await fetchTokenPricesByAddress(tokens);

    expect(post).toHaveBeenCalledTimes(2);
    expect(post.mock.calls[0][1].addresses).toHaveLength(ALCHEMY_PRICE_BATCH_SIZE);
    expect(post.mock.calls[1][1].addresses).toHaveLength(3);
    expect(Object.keys(prices)).toHaveLength(ALCHEMY_PRICE_BATCH_SIZE + 3);
  });

  it('keeps the prices from batches that succeeded when another one fails', async () => {
    const tokens = Array.from({ length: ALCHEMY_PRICE_BATCH_SIZE + 1 }, (_, i) => ({
      chainId: 8453,
      address: `0x${(i + 1).toString(16).padStart(40, '0')}`,
    }));
    post
      .mockResolvedValueOnce({
        data: { data: [priced('base-mainnet', tokens[0].address, '3')] },
      })
      .mockRejectedValueOnce(new Error('429 Too Many Requests'));

    await expect(fetchTokenPricesByAddress(tokens)).resolves.toEqual({
      [`8453:${tokens[0].address}`]: 3,
    });
  });

  it('drops entries Alchemy could not price and skips unsupported chains', async () => {
    post.mockResolvedValue({
      data: {
        data: [
          { network: 'base-mainnet', address: FUSE_BASE.toLowerCase(), prices: [] },
          priced('base-mainnet', USDC_BASE.toLowerCase(), '0'),
        ],
      },
    });

    // Fuse (122) has no Alchemy network, so it never reaches the request.
    const prices = await fetchTokenPricesByAddress([
      { chainId: 8453, address: FUSE_BASE },
      { chainId: 8453, address: USDC_BASE },
      { chainId: 122, address: '0x0BE9e53fd7EDaC9F859882AfdDa116645287C629' },
    ]);

    expect(post.mock.calls[0][1].addresses).toHaveLength(2);
    expect(prices).toEqual({});
  });

  it('does not call Alchemy when nothing needs a price', async () => {
    await expect(fetchTokenPricesByAddress([])).resolves.toEqual({});
    expect(post).not.toHaveBeenCalled();
  });
});
