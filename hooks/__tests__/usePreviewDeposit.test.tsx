import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { usePreviewDeposit } from '@/hooks/usePreviewDeposit';
import { getLifiQuote } from '@/lib/api';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { act, create } = require('react-test-renderer');

const SAFE = '0x000acC8042eA362149ce2b2709Fc497B6505634E';
const USDT = '0xdAC17F958D2ee523a2206206994597C13D831ec7';
const USDC = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48';

jest.mock('@/lib/api', () => ({ getLifiQuote: jest.fn() }));
jest.mock('@/lib/wagmi', () => ({ config: {} }));
// 1 soUSD = 1.086799 USDC.
jest.mock('wagmi/query', () => ({
  readContractQueryOptions: () => ({
    queryKey: ['accountant-rate'],
    queryFn: async () => 1_086_799n,
  }),
}));

const lifiQuote = getLifiQuote as jest.Mock;

type Result = ReturnType<typeof usePreviewDeposit>;

let root: ReturnType<typeof create> | undefined;
let client: QueryClient | undefined;

const renderPreview = async (...args: Parameters<typeof usePreviewDeposit>): Promise<Result> => {
  const seen: Result[] = [];
  const Probe = () => {
    seen.push(usePreviewDeposit(...args));
    return null;
  };
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () => {
    root = create(
      <QueryClientProvider client={client!}>
        <Probe />
      </QueryClientProvider>,
    );
  });
  // Let the rate and the quote settle.
  for (let i = 0; i < 5; i++) {
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });
  }
  return seen[seen.length - 1];
};

beforeEach(() => jest.clearAllMocks());
// An open query client keeps its cache timers alive and holds Jest open.
afterEach(async () => {
  await act(async () => root?.unmount());
  client?.clear();
});

// LI.FI simulates the route from `fromAddress`: quoting from the USDT contract
// itself reverted every time, so the preview showed 0 soUSD.
it('quotes USDT on Ethereum from the wallet the deposit comes from', async () => {
  lifiQuote.mockResolvedValue({ estimate: { toAmount: '8681117474' } });

  const preview = await renderPreview('8713.87592', USDT, 1, SAFE);

  expect(lifiQuote).toHaveBeenCalledWith(
    expect.objectContaining({
      fromAddress: SAFE,
      toAddress: SAFE,
      fromToken: USDT,
      toToken: USDC,
      fromAmount: 8_713_875_920n,
    }),
  );
  expect(preview.isQuoteUnavailable).toBe(false);
  expect(preview.amountOut).toBeCloseTo(8_681_117_474 / 1_086_799, 6);
  expect(preview.routingFee).toBeCloseTo(32.758446, 6);
});

it('parses the amount in the token’s own decimals', async () => {
  lifiQuote.mockResolvedValue({ estimate: { toAmount: '99900000' } });

  await renderPreview('100', USDT, 56, SAFE, 18);

  expect(lifiQuote).toHaveBeenCalledWith(
    expect.objectContaining({ fromAmount: 100_000_000_000_000_000_000n }),
  );
});

it('reports no quote rather than 0 when LI.FI finds no route', async () => {
  lifiQuote.mockRejectedValue(new Error('422'));

  const preview = await renderPreview('100', USDT, 1, SAFE);

  expect(preview.isQuoteUnavailable).toBe(true);
});

it('asks LI.FI nothing without a wallet to quote from', async () => {
  const preview = await renderPreview('100', USDT, 1, undefined);

  expect(lifiQuote).not.toHaveBeenCalled();
  expect(preview.isQuoteUnavailable).toBe(true);
});

it('needs no quote for USDC on Ethereum', async () => {
  const preview = await renderPreview('100', USDC, 1, SAFE);

  expect(lifiQuote).not.toHaveBeenCalled();
  expect(preview.isQuoteUnavailable).toBe(false);
  expect(preview.amountOut).toBeCloseTo(100_000_000 / 1_086_799, 6);
});
