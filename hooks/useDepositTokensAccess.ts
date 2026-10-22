import { useQuery } from '@tanstack/react-query';

import useUser from '@/hooks/useUser';
import { getDepositTokensAccess } from '@/lib/api';
import { isDevFeatureEnabled } from '@/lib/config';

export const DEPOSIT_TOKENS_ACCESS_QUERY_KEY = 'depositTokensAccess';

/** How long the gate is trusted before it is asked again. */
const STALE_MS = 5 * 60 * 1000;

/**
 * Whether this user may be offered the deposit tokens still being rolled out:
 * PAXG, WBTC, cbBTC and the rest added with Optimism, and Optimism itself for
 * the tokens already offered elsewhere (see `releasedOn` in
 * `constants/walletDepositTokens`).
 *
 * QA and preview builds offer them to everyone. Production offers them only to
 * the internal team members tagged "New deposit tokens" on the admin dashboard
 * while the backend gates them (`DEPOSIT_TOKENS_COHORT_ONLY`), so the answer
 * comes from the server rather than from the build.
 *
 * Fails closed, like `useCardSpendModeAccess`: `false` until the request answers and
 * `false` if it fails, so the screen lists what everyone is offered until the
 * server says otherwise.
 *
 * This gates OFFERING them on the deposit screen. A balance or receive in one is
 * still shown: the tokens go to the user's own Safe, which anyone can send to.
 */
export const useDepositTokensAccess = (): { isEnabled: boolean; isLoading: boolean } => {
  const { user } = useUser();

  const { data, isLoading } = useQuery({
    queryKey: [DEPOSIT_TOKENS_ACCESS_QUERY_KEY, user?.userId],
    queryFn: getDepositTokensAccess,
    // Nothing to ask without a signed-in user (the request would 401), and nothing to ask on a
    // build that offers them to everyone.
    enabled: !isDevFeatureEnabled && !!user?.userId,
    staleTime: STALE_MS,
    retry: 1,
  });

  if (isDevFeatureEnabled) return { isEnabled: true, isLoading: false };

  return {
    isEnabled: data?.enabled === true,
    isLoading: !!user?.userId && isLoading,
  };
};

export default useDepositTokensAccess;
