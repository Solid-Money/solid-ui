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
const { post, get } = (require('axios') as { default: { post: jest.Mock; get: jest.Mock } })
  .default;
const {
  clearAlchemyPriceCache,
  fetchTokenPricesByAddress,
  fetchTokenPricesBySymbol,
  fetchTokenPriceUsd,
} = require('@/lib/api') as typeof import('@/lib/api');
/* eslint-enable @typescript-eslint/no-require-imports */

const USDC_BASE = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const FUSE_BASE = '0x01FaCC69ec7360640Aa5898e852326752801674a';
const USDC_ETHEREUM = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';

const priced = (network: string, address: string, value: string) => ({
  network,
  address,
  prices: [{ currency: 'usd', value, lastUpdatedAt: '2026-09-09T00:00:00Z' }],
});

const bySymbol = (symbol: string, value?: string) => ({
  symbol,
  prices: value ? [{ currency: 'usd', value, lastUpdatedAt: '2026-09-09T00:00:00Z' }] : [],
  ...(value ? {} : { error: { message: `Price not found for symbol: ${symbol}` } }),
});

/** Symbols a by-symbol GET asked for, in order. */
const requestedSymbols = (url: string) =>
  new URL(url).searchParams.getAll('symbols').map(s => decodeURIComponent(s));

const rateLimited = () =>
  Object.assign(new Error('Request failed with status code 429'), {
    response: { status: 429, headers: {} },
  });

beforeEach(() => {
  post.mockReset();
  get.mockReset();
  // Prices are shared module-wide for a minute; start every test cold.
  clearAlchemyPriceCache();
});

describe('fetchTokenPricesBySymbol', () => {
  it('asks for every symbol looked up in the same tick in one request', async () => {
    get.mockResolvedValue({
      data: { data: [bySymbol('ETH', '2658.09'), bySymbol('BNB', '765.87')] },
    });

    // The native fetchers in useBalances ask for ETH once per chain.
    const [ethereum, bsc, base] = await Promise.all([
      fetchTokenPriceUsd('ETH'),
      fetchTokenPriceUsd('BNB'),
      fetchTokenPriceUsd('ETH'),
    ]);

    expect(get).toHaveBeenCalledTimes(1);
    expect(get.mock.calls[0][0]).toContain('/tokens/by-symbol?');
    expect(requestedSymbols(get.mock.calls[0][0])).toEqual(['ETH', 'BNB']);
    expect([ethereum, bsc, base]).toEqual(['2658.09', '765.87', '2658.09']);
  });

  it('matches the upper-cased symbols Alchemy echoes back', async () => {
    get.mockResolvedValue({
      data: { data: [bySymbol('FUSE-NETWORK-TOKEN', '0.00805'), bySymbol('SOUSD', '1.066')] },
    });

    await expect(fetchTokenPricesBySymbol(['fuse-network-token', 'soUSD'])).resolves.toEqual({
      'fuse-network-token': 0.00805,
      soUSD: 1.066,
    });
  });

  it('chunks past the 25-symbol cap', async () => {
    const symbols = Array.from({ length: ALCHEMY_PRICE_BATCH_SIZE + 2 }, (_, i) => `TOKEN${i}`);
    get.mockImplementation((url: string) =>
      Promise.resolve({ data: { data: requestedSymbols(url).map(s => bySymbol(s, '1')) } }),
    );

    const prices = await fetchTokenPricesBySymbol(symbols);

    expect(get).toHaveBeenCalledTimes(2);
    expect(requestedSymbols(get.mock.calls[0][0])).toHaveLength(ALCHEMY_PRICE_BATCH_SIZE);
    expect(requestedSymbols(get.mock.calls[1][0])).toHaveLength(2);
    expect(Object.keys(prices)).toHaveLength(ALCHEMY_PRICE_BATCH_SIZE + 2);
  });

  it('encodes symbols that are not URL-safe', async () => {
    get.mockResolvedValue({ data: { data: [] } });

    await fetchTokenPricesBySymbol(['G$', 'USDC.E']);

    expect(get.mock.calls[0][0]).toContain('symbols=G%24&symbols=USDC.E');
  });

  it('reuses a price for later callers instead of asking again', async () => {
    get.mockResolvedValue({ data: { data: [bySymbol('ETH', '2658.09')] } });

    await fetchTokenPriceUsd('ETH');
    await expect(fetchTokenPriceUsd('ETH')).resolves.toBe('2658.09');

    expect(get).toHaveBeenCalledTimes(1);
  });

  it('remembers symbols Alchemy has no price for', async () => {
    get.mockResolvedValue({ data: { data: [bySymbol('NOTAREALTOKEN')] } });

    await expect(fetchTokenPriceUsd('NOTAREALTOKEN')).resolves.toBeUndefined();
    await expect(fetchTokenPriceUsd('NOTAREALTOKEN')).resolves.toBeUndefined();

    expect(get).toHaveBeenCalledTimes(1);
  });

  it('stops calling either endpoint once the token_price quota is spent', async () => {
    get.mockRejectedValueOnce(rateLimited());

    await expect(fetchTokenPriceUsd('ETH')).resolves.toBeUndefined();
    await expect(fetchTokenPricesBySymbol(['BNB'])).resolves.toEqual({});
    await expect(
      fetchTokenPricesByAddress([{ chainId: 8453, address: USDC_BASE }]),
    ).resolves.toEqual({});

    expect(get).toHaveBeenCalledTimes(1);
    expect(post).not.toHaveBeenCalled();
  });

  it('keeps showing the last price while rate-limited', async () => {
    const now = jest.spyOn(Date, 'now');
    try {
      now.mockReturnValue(1_000_000);
      get.mockResolvedValueOnce({ data: { data: [bySymbol('ETH', '2658.09')] } });
      await fetchTokenPriceUsd('ETH');

      now.mockReturnValue(1_000_000 + 61_000); // past the one-minute TTL
      get.mockRejectedValueOnce(rateLimited());

      await expect(fetchTokenPriceUsd('ETH')).resolves.toBe('2658.09');
      expect(get).toHaveBeenCalledTimes(2);
    } finally {
      now.mockRestore();
    }
  });
});

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

  it('keeps each request within the three-network cap', async () => {
    post.mockResolvedValue({ data: { data: [] } });

    // One token on each of the five Alchemy-served chains.
    await fetchTokenPricesByAddress(
      [1, 8453, 137, 42161, 56].map(chainId => ({ chainId, address: USDC_BASE })),
    );

    expect(post).toHaveBeenCalledTimes(2);
    const networks = post.mock.calls.map(
      ([, body]: [string, { addresses: { network: string }[] }]) =>
        new Set(body.addresses.map(a => a.network)).size,
    );
    expect(networks).toEqual([3, 2]);
  });

  it('reuses prices for later callers instead of asking again', async () => {
    post.mockResolvedValue({
      data: { data: [priced('base-mainnet', USDC_BASE.toLowerCase(), '1.0001')] },
    });

    await fetchTokenPricesByAddress([{ chainId: 8453, address: USDC_BASE }]);
    await expect(
      fetchTokenPricesByAddress([{ chainId: 8453, address: USDC_BASE }]),
    ).resolves.toEqual({ [`8453:${USDC_BASE.toLowerCase()}`]: 1.0001 });

    expect(post).toHaveBeenCalledTimes(1);
  });
});
