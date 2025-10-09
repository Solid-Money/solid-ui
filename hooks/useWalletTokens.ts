import { useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';

import { useBalances } from './useBalances';
import useUser from './useUser';

export const useWalletTokens = () => {
  const { user } = useUser();
  const queryClient = useQueryClient();

  const {
    totalUSD,
    soUSDEthereum,
    soUSDFuse,
    totalUSDExcludingSoUSD,
    ethereumTokens,
    fuseTokens,
    tokens,
    isLoading,
    isRefreshing,
    error,
    refresh,
    retry
  } = useBalances();


  const hasTokens = useMemo(
    () => ethereumTokens.length > 0 || fuseTokens.length > 0,
    [ethereumTokens.length, fuseTokens.length]
  );

  const uniqueTokens = useMemo(
    () => tokens.filter((token, index, self) =>
      index === self.findIndex((t) => t.contractTickerSymbol === token.contractTickerSymbol)
    ),
    [tokens]
  );

  // Enhanced refresh function that invalidates the query when balances change
  const enhancedRefresh = useMemo(() => {
    return () => {
      // Invalidate the token balances query to force a fresh fetch
      queryClient.invalidateQueries({
        queryKey: ["tokenBalances", user?.safeAddress]
      });
      refresh();
    };
  }, [queryClient, user?.safeAddress, refresh]);

  return {
    totalUSD,
    soUSDEthereum,
    soUSDFuse,
    totalUSDExcludingSoUSD,
    ethereumTokens,
    fuseTokens,
    tokens,
    uniqueTokens,
    isLoading,
    isRefreshing,
    hasTokens,
    error,
    retry,
    refresh: enhancedRefresh,
  };
};
