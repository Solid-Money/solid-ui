import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import { XSTOCKS_TOKENS } from '@/constants/xstocksTokens';
import { cowGetTokenUsdPrice } from '@/lib/cowswap';

// Maps ticker symbol → live USD price via CoW BFF /tokens/{address}/usdPrice.
// Faster than quotes since it's a single price lookup per token with no order simulation.
export function useXStockPrices(tickers: string[]): Record<string, number> {
  const tokenMap = useMemo(() => new Map(XSTOCKS_TOKENS.map(t => [t.symbol, t])), []);

  const { data } = useQuery({
    queryKey: ['xstockPrices', tickers.join(',')],
    queryFn: async () => {
      const results = await Promise.allSettled(
        tickers.map(async ticker => {
          const token = tokenMap.get(ticker);
          if (!token) return null;
          const price = await cowGetTokenUsdPrice(token.contractAddress);
          if (price == null) return null;
          return { ticker, price };
        }),
      );

      const prices: Record<string, number> = {};
      for (const r of results) {
        if (r.status === 'fulfilled' && r.value) {
          prices[r.value.ticker] = r.value.price;
        }
      }
      return prices;
    },
    enabled: tickers.length > 0,
    staleTime: 60_000,
    refetchInterval: 60_000,
  });

  return data ?? {};
}
