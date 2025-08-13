import { useEffect, useMemo } from 'react';
import { Address, zeroAddress } from 'viem';

import { algebraInfoClient } from '@/graphql/clients';
import { useAllTokensQuery } from '@/graphql/generated/algebra-info';
import { useFetchTokenList } from '@/hooks/tokens/useFetchTokenList';
import { TokenListItem } from '@/lib/types/tokens';
import { useCachedTokensStore } from '@/store/cachedTokensStore';
import { useTokensState } from '@/store/tokensStore';
import { fuse } from 'viem/chains';

export function useAllTokens(showNativeToken = true) {
  const chainId = fuse.id;

  const { data: allTokens, loading } = useAllTokensQuery({
    client: algebraInfoClient,
  });
  const { tokenList, loading: loadingTokenList } = useFetchTokenList();

  const { importedTokens } = useTokensState();
  const { getCachedTokens, setCachedTokens } = useCachedTokensStore();

  // Try to get cached tokens first
  const cachedTokens = getCachedTokens(chainId);
  const shouldUseCachedData = cachedTokens && !loading && !loadingTokenList;

  const tokensBlackList: Address[] = useMemo(() => [], []);

  const mergedTokens = useMemo(() => {
    // Use cached data if available and fresh
    if (shouldUseCachedData) {
      const tokens = new Map<Address, TokenListItem>();

      // Add cached tokens
      for (const token of cachedTokens) {
        tokens.set(token.address.toLowerCase() as Address, token);
      }

      // Always merge imported tokens (they change frequently)
      const _importedTokens = Object.values(importedTokens[chainId] || []);
      for (const token of _importedTokens) {
        tokens.set(token.address.toLowerCase() as Address, { ...token });
      }

      return [...tokens].map(([, token]) => ({ ...token }));
    }

    // Fresh data processing (original logic)
    const tokens = new Map<Address, TokenListItem>();

    if (!allTokens) {
      const _importedTokens = Object.values(importedTokens[chainId] || []);
      for (const token of _importedTokens) {
        tokens.set(token.address.toLowerCase() as Address, {
          ...token,
        });
      }
      return [...tokens].map(([, token]) => ({ ...token }));
    }

    if (showNativeToken)
      tokens.set(zeroAddress, {
        address: zeroAddress,
        symbol: fuse.nativeCurrency.symbol,
        name: fuse.nativeCurrency.name,
        decimals: fuse.nativeCurrency.decimals,
        chainId: chainId,
      });

    for (const token of allTokens.tokens.filter(
      token => !tokensBlackList.includes(token.id as Address),
    )) {
      tokens.set(token.id.toLowerCase() as Address, {
        address: token.id as Address,
        symbol: token.symbol,
        name: token.name,
        decimals: token.decimals,
        chainId,
      });
    }

    const _importedTokens = Object.values(importedTokens[chainId] || []);

    for (const token of _importedTokens) {
      tokens.set(token.address.toLowerCase() as Address, { ...token });
    }

    if (tokenList) {
      for (const token of tokenList) {
        tokens.set(token.address.toLowerCase() as Address, { ...token });
      }
    }

    return [...tokens].map(([, token]) => ({ ...token }));
  }, [
    allTokens,
    importedTokens,
    chainId,
    showNativeToken,
    tokensBlackList,
    tokenList,
    shouldUseCachedData,
    cachedTokens,
  ]);

  // Cache fresh data when it becomes available
  useEffect(() => {
    if (
      !loading &&
      !loadingTokenList &&
      allTokens &&
      mergedTokens.length > 0 &&
      !shouldUseCachedData
    ) {
      setCachedTokens(chainId, mergedTokens);
    }
  }, [
    loading,
    loadingTokenList,
    allTokens,
    mergedTokens,
    chainId,
    shouldUseCachedData,
    setCachedTokens,
  ]);

  return useMemo(
    () => ({
      tokens: mergedTokens,
      isLoading: loading || loadingTokenList || Boolean(allTokens && !mergedTokens.length),
    }),
    [mergedTokens, allTokens, loading, loadingTokenList],
  );
}
