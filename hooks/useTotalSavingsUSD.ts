import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Address } from 'viem';
import { fuse } from 'viem/chains';

import { NATIVE_COINGECKO_TOKENS, NATIVE_TOKENS } from '@/constants/tokens';
import { VAULTS } from '@/constants/vaults';
import useUser from '@/hooks/useUser';
import { useVaultBalance } from '@/hooks/useVault';
import { useVaultExchangeRate } from '@/hooks/useVaultExchangeRate';
import { fetchCoinSimplePrice, fetchTokenPriceUsd } from '@/lib/api';

const ACTIVE_VAULTS = VAULTS.filter(v => !('isComingSoon' in v && v.isComingSoon));
const usdcVault = ACTIVE_VAULTS[0];
const fuseVault = ACTIVE_VAULTS[1];

/** Fetch FUSE/USD price with CoinGecko fallback when Alchemy returns nothing. */
const fetchFusePrice = async (): Promise<string | undefined> => {
  // Try Alchemy first
  try {
    const price = await fetchTokenPriceUsd(NATIVE_TOKENS[fuse.id]);
    if (price != null && Number(price) > 0) return price;
  } catch {
    // fall through to CoinGecko
  }

  // Fallback: CoinGecko
  const coinId = NATIVE_COINGECKO_TOKENS[fuse.id];
  if (!coinId) return undefined;
  const priceMap = await fetchCoinSimplePrice([coinId]);
  const usd = priceMap[coinId]?.usd;
  return usd != null && usd > 0 ? String(usd) : undefined;
};

export const useTotalSavingsUSD = (): { data: number | undefined; isLoading: boolean } => {
  const { user } = useUser();
  const address = user?.safeAddress as Address;
  const { data: balanceUsdc, isLoading: isLoadingBalanceUsdc } = useVaultBalance(
    address,
    usdcVault,
  );
  const { data: balanceFuse, isLoading: isLoadingBalanceFuse } = useVaultBalance(
    address,
    fuseVault ?? usdcVault,
  );
  const { data: exchangeRateUsdc, isLoading: isLoadingRateUsdc } = useVaultExchangeRate(
    usdcVault.name,
  );
  const { data: exchangeRateFuse, isLoading: isLoadingRateFuse } = useVaultExchangeRate(
    fuseVault?.name ?? usdcVault.name,
  );
  const { data: fusePriceUsd, isLoading: isLoadingFusePrice } = useQuery({
    queryKey: ['fusePriceUsd'],
    queryFn: fetchFusePrice,
    staleTime: 60_000,
  });

  const isLoading =
    isLoadingBalanceUsdc ||
    isLoadingBalanceFuse ||
    isLoadingRateUsdc ||
    isLoadingRateFuse ||
    isLoadingFusePrice;

  const data = useMemo(() => {
    if (isLoading) return undefined;
    const rateUsdc = exchangeRateUsdc ?? 1;
    const rateFuse = exchangeRateFuse ?? 1;
    const fusePrice = Number(fusePriceUsd) || 0;
    const redeemableUsdc = (balanceUsdc ?? 0) * rateUsdc;
    const redeemableFuse = fuseVault ? (balanceFuse ?? 0) * rateFuse * fusePrice : 0;
    return redeemableUsdc + redeemableFuse;
  }, [
    isLoading,
    balanceUsdc,
    balanceFuse,
    exchangeRateUsdc,
    exchangeRateFuse,
    fusePriceUsd,
  ]);

  return { data, isLoading };
};
