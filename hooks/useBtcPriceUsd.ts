import { useQuery } from '@tanstack/react-query';

import { NATIVE_PRICE_REFRESH_MS } from '@/hooks/useNativePriceUsd';
import { fetchCoinPricesById, fetchTokenPriceUsd } from '@/lib/api';

/**
 * The BTC price in USD, for soBTC's dollar figures: Alchemy by symbol first, then CoinGecko
 * through the backend's shared cache, as for the native-token prices. WBTC and cbBTC are both
 * valued at it (soBTC treats them 1:1).
 */
export const fetchBtcPriceUsd = async (): Promise<string | undefined> => {
  try {
    const price = await fetchTokenPriceUsd('BTC');
    if (price != null && Number(price) > 0) return price;
  } catch {
    // fall through to CoinGecko
  }
  const usd = (await fetchCoinPricesById(['bitcoin'])).bitcoin;
  return usd != null && usd > 0 ? String(usd) : undefined;
};

export const useBtcPriceQuery = (enabled = true) =>
  useQuery({
    queryKey: ['btcPriceUsd'],
    queryFn: fetchBtcPriceUsd,
    enabled,
    staleTime: NATIVE_PRICE_REFRESH_MS,
    refetchInterval: NATIVE_PRICE_REFRESH_MS,
  });

/** The BTC price as a number: 0 while disabled or unavailable. */
export const useBtcPriceUsd = (enabled = true): number => {
  const { data } = useBtcPriceQuery(enabled);
  return enabled ? Number(data) || 0 : 0;
};
