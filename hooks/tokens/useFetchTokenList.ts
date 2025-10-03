import axios from 'axios';
import { useEffect, useState } from 'react';

import { EXPO_PUBLIC_FLASH_API_BASE_URL } from '@/lib/config';
import { TokenListItem } from '@/lib/types/tokens';

// Type for the swap token response from backend
interface SwapTokenResponse {
  _id: string;
  name: string;
  address: string;
  symbol: string;
  decimals: number;
  chainId: number;
  logoURI?: string;
  isActive: boolean;
  displayOrder?: number;
  isFeatured: boolean;
  createdAt: string;
  updatedAt: string;
}

// Fallback to the original URL if backend is not available
const VOLTAGE_SWAP_DEFAULT_TOKEN_LIST_URL =
  'https://raw.githubusercontent.com/voltfinance/swap-default-token-list/master/build/voltage-swap-default.tokenlist.json';

export function useFetchTokenList() {
  const [tokenList, setTokenList] = useState<TokenListItem[] | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function fetchTokenList() {
      try {
        // Try to fetch from our backend swap-tokens endpoint
        const response = await axios.get<SwapTokenResponse[]>(
          `${EXPO_PUBLIC_FLASH_API_BASE_URL}/accounts/v1/swap-tokens`,
          {
            params: {
              isActive: true,
            },
          }
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
        const tokens: TokenListItem[] = sortedSwapTokens.map((swapToken) => ({
          name: swapToken.name,
          address: swapToken.address,
          symbol: swapToken.symbol,
          decimals: swapToken.decimals,
          chainId: swapToken.chainId,
          logoURI: swapToken.logoURI,
        }));

        setTokenList(tokens);
      } catch (backendError) {
        console.warn('Failed to fetch swap tokens from backend, falling back to original source:', backendError);

        // Fallback to original source if backend fails
        try {
          const response = await fetch(VOLTAGE_SWAP_DEFAULT_TOKEN_LIST_URL);
          if (!response.ok) {
            throw new Error('Failed to fetch swap token list from fallback source');
          }
          const data = await response.json();
          const tokenList = data.tokens;
          setTokenList(tokenList);
        } catch (fallbackError) {
          setError(fallbackError as Error);
        }
      } finally {
        setLoading(false);
      }
    }

    fetchTokenList();
  }, []);

  return { tokenList, loading, error };
}
