import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { Address } from 'viem';
import { fuse } from 'viem/chains';

import { EXPO_PUBLIC_FLASH_API_BASE_URL } from '@/lib/config';
import { SwapTokenResponse } from '@/lib/types';
import { TokenListItem } from '@/lib/types/tokens';

// Fallback to the original URL if backend is not available
const VOLTAGE_SWAP_DEFAULT_TOKEN_LIST_URL =
  'https://raw.githubusercontent.com/voltfinance/swap-default-token-list/master/build/voltage-swap-default.tokenlist.json';

const SWAP_TOKENS_KEY = 'swap-tokens';

async function fetchSwapTokens(): Promise<TokenListItem[]> {
  try {
    // Try to fetch from our backend swap-tokens endpoint
    const response = await axios.get<SwapTokenResponse[]>(
      `${EXPO_PUBLIC_FLASH_API_BASE_URL}/accounts/v1/swap-tokens`,
      {
        params: {
          isActive: true,
          chainId: fuse.id,
        },
      },
    );

    // Sort swap tokens by featured first, then by display order, then by symbol
    const sortedSwapTokens = response.data.sort((a, b) => {
      // Featured tokens come first
      if (a.isFeatured && !b.isFeatured) return -1;
      if (!a.isFeatured && b.isFeatured) return 1;

      // Then sort by display order (lower numbers first)
      const orderA = a.displayOrder ?? 999999;
      const orderB = b.displayOrder ?? 999999;
      if (orderA !== orderB) return orderA - orderB;

      // Finally sort alphabetically by symbol
      return a.symbol.localeCompare(b.symbol);
    });

    // Map to TokenListItem format for compatibility
    return sortedSwapTokens.map(swapToken => ({
      name: swapToken.name,
      address: swapToken.address as Address,
      symbol: swapToken.symbol,
      decimals: swapToken.decimals,
      chainId: swapToken.chainId,
      logoURI: swapToken.logoURI,
    }));
  } catch (backendError) {
    console.warn(
      'Failed to fetch swap tokens from backend, falling back to original source:',
      backendError,
    );

    // Fallback to original source if backend fails
    const response = await fetch(VOLTAGE_SWAP_DEFAULT_TOKEN_LIST_URL);
    if (!response.ok) {
      throw new Error('Failed to fetch swap token list from fallback source');
    }
    const data = await response.json();
    return data.tokens;
  }
}

export function useFetchTokenList() {
  const {
    data: tokenList,
    isLoading: loading,
    error,
  } = useQuery({
    queryKey: [SWAP_TOKENS_KEY, fuse.id],
    queryFn: fetchSwapTokens,
    staleTime: 5 * 60 * 1000, // 5 minutes - data considered fresh
    gcTime: 10 * 60 * 1000, // 10 minutes - garbage collect unused queries
  });

  return { tokenList: tokenList ?? null, loading, error: error ?? null };
}
