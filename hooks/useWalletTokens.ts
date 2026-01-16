import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';

import { useBalances } from './useBalances';
import useUser from './useUser';

export const useWalletTokens = () => {
  const { user } = useUser();
  const queryClient = useQueryClient();

  const {
    totalUSD,
    soUSDEthereum,
    soUSDFuse,
    soUSDBase,
    totalUSDExcludingSoUSD,
    ethereumTokens,
    fuseTokens,
    baseTokens,
    tokens,
    unifiedTokens,
    isLoading,
    isRefreshing,
    error,
    refresh,
    retry,
  } = useBalances();

  const hasTokens = useMemo(
    () => ethereumTokens.length > 0 || fuseTokens.length > 0 || baseTokens.length > 0,
    [ethereumTokens.length, fuseTokens.length, baseTokens.length],
  );

  const uniqueTokens = useMemo(
    () =>
      tokens.filter(
        (token, index, self) =>
          index === self.findIndex(t => t.contractTickerSymbol === token.contractTickerSymbol),
      ),
    [tokens],
  );

  // Enhanced refresh function that invalidates the query when balances change
  // Using useCallback for stable reference - important to prevent re-render loops
  // when this function is used as a useEffect dependency
  const enhancedRefresh = useCallback(() => {
    // Invalidate the token balances query to force a fresh fetch
    queryClient.invalidateQueries({
      queryKey: ['tokenBalances', user?.safeAddress],
    });
    refresh();
  }, [queryClient, user?.safeAddress, refresh]);

  return {
    totalUSD,
    soUSDEthereum,
    soUSDFuse,
    soUSDBase,
    totalUSDExcludingSoUSD,
    ethereumTokens,
    fuseTokens,
    baseTokens,
    tokens,
    unifiedTokens,
    uniqueTokens,
    isLoading,
    isRefreshing,
    hasTokens,
    error,
    retry,
    refresh: enhancedRefresh,
  };
};
