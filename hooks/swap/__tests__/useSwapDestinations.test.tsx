import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { zeroAddress } from 'viem';

import { useSwapDestinations } from '@/hooks/swap/useSwapDestinations';
import { fetchLifiSwapDestinations } from '@/lib/api/lifi-swap';
import { SwapAsset } from '@/lib/types/lifi-swap';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { act, create } = require('react-test-renderer');

jest.mock('@/lib/api/lifi-swap', () => ({ fetchLifiSwapDestinations: jest.fn() }));
jest.mock('@/lib/utils', () => ({ withRefreshToken: (call: () => unknown) => call() }));
jest.mock('@/hooks/useUser', () => ({
  __esModule: true,
  default: () => ({ user: { userId: 'user-1' } }),
}));

const mockFetch = fetchLifiSwapDestinations as jest.MockedFunction<
  typeof fetchLifiSwapDestinations
>;

const FUSE_USDC: SwapAsset = {
  chainId: 122,
  address: '0xc6Bc407706B7140EE8Eef2f86F9504651b63e7f9',
  symbol: 'USDC',
  name: 'USD Coin',
  decimals: 6,
  isNative: false,
};
const BASE_USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

const settle = () =>
  act(async () => {
    await new Promise(resolve => setTimeout(resolve, 0));
  });

/** What the hook answers once React Query has the backend's reply. */
const answerFor = async (from: SwapAsset) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const answers: (ReadonlySet<string> | null)[] = [];
  const Probe = () => {
    answers.push(useSwapDestinations(from));
    return null;
  };
  let root: any;
  await act(async () => {
    root = create(
      <QueryClientProvider client={client}>
        <Probe />
      </QueryClientProvider>,
    );
  });
  await settle();
  await act(async () => root.unmount());
  client.clear();
  return answers.at(-1) ?? null;
};

beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  jest.clearAllMocks();
});

it('asks the backend what a Fuse coin can become, and keeps to its list', async () => {
  mockFetch.mockResolvedValue({
    fromChainId: 122,
    fromToken: FUSE_USDC.address.toLowerCase(),
    routesChecked: true,
    destinations: [
      { chainId: 8453, address: BASE_USDC.toLowerCase(), symbol: 'USDC' },
      { chainId: 8453, address: zeroAddress, symbol: 'ETH' },
    ],
  } as never);

  const answer = await answerFor(FUSE_USDC);

  expect(mockFetch).toHaveBeenCalledWith(
    { fromChain: 122, fromToken: FUSE_USDC.address },
    expect.anything(),
  );
  expect(answer && [...answer]).toEqual([`8453:${BASE_USDC.toLowerCase()}`, `8453:${zeroAddress}`]);
});

it('offers the whole list when the backend couldn’t check routes', async () => {
  mockFetch.mockResolvedValue({
    fromChainId: 122,
    fromToken: FUSE_USDC.address.toLowerCase(),
    routesChecked: false,
    destinations: [],
  } as never);

  expect(await answerFor(FUSE_USDC)).toBeNull();
});
