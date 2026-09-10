import { useMemo } from 'react';
import { useQueries } from '@tanstack/react-query';

import { XSTOCKS_TOKENS } from '@/constants/xstocksTokens';
import { cowGetTokenUsdPrice } from '@/lib/cowswap';

const PRICE_STALE_MS = 60_000;

/**
 * Maps ticker symbol → live USD price via CoW BFF /tokens/{address}/usdPrice.
 * Faster than quotes since it's a single price lookup per token with no order
 * simulation.
 *
 * One query per ticker rather than one keyed on the whole list: a list that
 * grows — the Earn catalog paging in more rows as it scrolls — would otherwise
 * change the key on every page and refetch every ticker it had already
 * fetched, so reaching the end of 160-odd assets would cost thousands of
 * requests instead of one per asset.
 */
export function useXStockPrices(tickers: string[]): Record<string, number> {
  const tokenMap = useMemo(() => new Map(XSTOCKS_TOKENS.map(t => [t.symbol, t])), []);

  return useQueries({
    queries: tickers.map(ticker => ({
      queryKey: ['xstockPrice', ticker],
      queryFn: async () => {
        const token = tokenMap.get(ticker);
        if (!token) return null;
        return (await cowGetTokenUsdPrice(token.contractAddress)) ?? null;
      },
      staleTime: PRICE_STALE_MS,
      refetchInterval: PRICE_STALE_MS,
    })),
    combine: results => {
      const prices: Record<string, number> = {};
      results.forEach((result, index) => {
        if (typeof result.data === 'number') prices[tickers[index]] = result.data;
      });
      return prices;
    },
  });
}
