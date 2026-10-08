import { useQuery } from '@tanstack/react-query';

import { getVirtualAccountMicroDeposits } from '@/lib/api';
import { withRefreshToken } from '@/lib/utils';

export const VIRTUAL_ACCOUNT_MICRO_DEPOSITS_KEY = 'virtualAccountMicroDeposits';

/**
 * Deposits under Rain's $2 minimum on the user's virtual account — the amounts a
 * bank sends to check the account is theirs.
 *
 * Refetched on every mount rather than trusted from cache: the user opens this
 * screen *because* their bank just said it sent something, and a cached empty
 * list from an hour ago is exactly the wrong answer then.
 */
export function useVirtualAccountMicroDeposits(enabled = true) {
  return useQuery({
    queryKey: [VIRTUAL_ACCOUNT_MICRO_DEPOSITS_KEY],
    queryFn: () => withRefreshToken(() => getVirtualAccountMicroDeposits()),
    enabled,
    retry: 1,
    staleTime: 0,
    refetchOnMount: 'always',
  });
}
