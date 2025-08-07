import deepMerge from 'lodash.merge';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import mmkvStorage from '@/lib/mmvkStorage';
import { TokenListItem } from '@/lib/types/tokens';

interface CachedTokenData {
  tokens: TokenListItem[];
  timestamp: number;
  chainId: number;
}

interface CachedTokensState {
  cachedData: Record<number, CachedTokenData>;
  setCachedTokens: (chainId: number, tokens: TokenListItem[]) => void;
  getCachedTokens: (chainId: number, maxAgeMs?: number) => TokenListItem[] | null;
  clearCache: (chainId?: number) => void;
  isCacheValid: (chainId: number, maxAgeMs?: number) => boolean;
}

// Default cache duration: 1 hour
const DEFAULT_CACHE_DURATION = 60 * 60 * 1000;

export const useCachedTokensStore = create<CachedTokensState>()(
  persist(
    (set, get) => ({
      cachedData: {},

      setCachedTokens: (chainId: number, tokens: TokenListItem[]) => {
        const { cachedData } = get();

        set({
          cachedData: {
            ...cachedData,
            [chainId]: {
              tokens,
              timestamp: Date.now(),
              chainId,
            },
          },
        });
      },

      getCachedTokens: (chainId: number, maxAgeMs = DEFAULT_CACHE_DURATION) => {
        const { cachedData, isCacheValid } = get();
        const cached = cachedData[chainId];

        if (!cached) {
          return null;
        }

        if (!isCacheValid(chainId, maxAgeMs)) {
          return null;
        }

        return cached.tokens;
      },

      isCacheValid: (chainId: number, maxAgeMs = DEFAULT_CACHE_DURATION) => {
        const { cachedData } = get();
        const cached = cachedData[chainId];

        if (!cached) {
          return false;
        }

        const now = Date.now();
        const isValid = (now - cached.timestamp) < maxAgeMs;

        return isValid;
      },

      clearCache: (chainId?: number) => {
        const { cachedData } = get();

        if (chainId) {
          const newCachedData = { ...cachedData };
          delete newCachedData[chainId];
          set({ cachedData: newCachedData });
        } else {
          set({ cachedData: {} });
        }
      },
    }),
    {
      name: 'swap-tokens',
      storage: createJSONStorage(() => mmkvStorage('swap-tokens')),
      merge: (persistedState, currentState) => deepMerge(currentState, persistedState),
      // Only persist if we have valid data
      partialize: (state) => {
        const validCachedData = Object.entries(state.cachedData).reduce((acc, [chainId, data]) => {
          // Only persist recent cache entries (within 24 hours)
          const maxAge = 24 * 60 * 60 * 1000;
          if (Date.now() - data.timestamp < maxAge) {
            acc[Number(chainId)] = data;
          }
          return acc;
        }, {} as Record<number, CachedTokenData>);

        return {
          cachedData: validCachedData,
        };
      },
    }
  )
);