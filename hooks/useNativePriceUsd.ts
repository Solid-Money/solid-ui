import { useQuery } from '@tanstack/react-query';

import { NATIVE_COINGECKO_TOKENS, NATIVE_TOKENS } from '@/constants/tokens';
import { fetchCoinSimplePrice, fetchTokenPriceUsd } from '@/lib/api';

/**
 * Native-token USD price fetcher for a chain (Alchemy first, CoinGecko fallback).
 * Shared by useTotalSavingsUSD (FUSE + ETH terms) and the per-vault savings card.
 */
export const makeNativePriceFetcher =
  (chainId: number) => async (): Promise<string | undefined> => {
    try {
      const price = await fetchTokenPriceUsd(NATIVE_TOKENS[chainId]);
      if (price != null && Number(price) > 0) return price;
    } catch {
      // fall through to CoinGecko
    }

    const coinId = NATIVE_COINGECKO_TOKENS[chainId];
    if (!coinId) return undefined;
    const priceMap = await fetchCoinSimplePrice([coinId]);
    const usd = priceMap[coinId]?.usd;
    return usd != null && usd > 0 ? String(usd) : undefined;
  };

/**
 * USD price of a chain's native token as a number (0 when disabled/unavailable).
 * `queryKey` is shared with useTotalSavingsUSD ('fusePriceUsd' / 'ethPriceUsd')
 * so the two hooks reuse one cached request.
 */
export const useNativePriceUsd = (chainId: number, queryKey: string, enabled: boolean): number => {
  const { data } = useQuery({
    queryKey: [queryKey],
    queryFn: makeNativePriceFetcher(chainId),
    enabled,
    staleTime: 5_000,
    refetchInterval: 5_000,
  });
  return enabled ? Number(data) || 0 : 0;
};
