import { useQuery } from '@tanstack/react-query';

import { NATIVE_COINGECKO_TOKENS, NATIVE_TOKENS } from '@/constants/tokens';
import { fetchCoinSimplePrice, fetchTokenPriceUsd } from '@/lib/api';

/**
 * How often native-token prices refresh. Alchemy updates its prices about once
 * a minute, so polling faster (this was 5s) only spent Prices API quota on the
 * same number.
 */
export const NATIVE_PRICE_REFRESH_MS = 60_000;

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
 * Query for a chain's native-token USD price. `queryKey` is shared by every
 * caller for the same chain ('fusePriceUsd' / 'ethPriceUsd'), so they all read
 * one cached request.
 */
export const useNativePriceQuery = (chainId: number, queryKey: string, enabled: boolean) =>
  useQuery({
    queryKey: [queryKey],
    queryFn: makeNativePriceFetcher(chainId),
    enabled,
    staleTime: NATIVE_PRICE_REFRESH_MS,
    refetchInterval: NATIVE_PRICE_REFRESH_MS,
  });

/** USD price of a chain's native token as a number (0 when disabled/unavailable). */
export const useNativePriceUsd = (chainId: number, queryKey: string, enabled: boolean): number => {
  const { data } = useNativePriceQuery(chainId, queryKey, enabled);
  return enabled ? Number(data) || 0 : 0;
};
