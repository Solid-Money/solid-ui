import { useQuery } from '@tanstack/react-query';

import { getDepositAssets } from '@/lib/api';

export const DEPOSIT_ASSETS_QUERY_KEY = 'deposit-assets';

/**
 * The deposit pipeline's own asset list and minimums.
 *
 * Every consumer treats this as an improvement on its committed fallback rather
 * than a requirement: the endpoint is config, it is the same answer for
 * everyone, and a deposit screen that showed no minimum while it loaded would be
 * worse than one showing an approximate figure immediately. So failures are not
 * surfaced — `data` is simply absent and callers fall back.
 *
 * One retry rather than the default three: until the endpoint is deployed
 * everywhere this 404s, and there is no point spending three requests to learn
 * that on every mount.
 */
export const useDepositAssets = () =>
  useQuery({
    queryKey: [DEPOSIT_ASSETS_QUERY_KEY],
    queryFn: getDepositAssets,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
