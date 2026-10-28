import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import { fetchTokenList } from '@/lib/api';
import { ListedTokens, toListedTokens } from '@/lib/utils/tokenAllowlist';

/** Shared with the swap form, which reads the same list. */
export const SWAP_TOKENS_ALL_CHAINS_KEY = ['swap-tokens', 'all-chains'];

/**
 * The curated token list (every chain, active only) as a lookup set — the one
 * the wallet's balances are filtered on. Null until it loads, or when it fails,
 * which callers read as "filter nothing". See `lib/utils/tokenAllowlist`.
 */
export function useListedTokens(): ListedTokens | null {
  const { data } = useQuery({
    queryKey: SWAP_TOKENS_ALL_CHAINS_KEY,
    queryFn: () => fetchTokenList({ isActive: true }),
    staleTime: 5 * 60_000,
  });

  return useMemo(() => toListedTokens(data), [data]);
}
