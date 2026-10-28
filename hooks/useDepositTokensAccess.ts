import { useQuery } from '@tanstack/react-query';

import useUser from '@/hooks/useUser';
import { getDepositTokensAccess } from '@/lib/api';

export const DEPOSIT_TOKENS_ACCESS_QUERY_KEY = 'depositTokensAccess';

/** How long the gate is trusted before it is asked again. */
const STALE_MS = 5 * 60 * 1000;

/**
 * Whether this user may be offered the deposit tokens still being rolled out:
 * cbBTC, cbZEC, AAVE and SOL on Base (see `releasedOn` in
 * `constants/walletDepositTokens`).
 *
 * The server decides, on every build: while `DEPOSIT_TOKENS_COHORT_ONLY` gates
 * them (production) only the internal team members tagged "New deposit tokens"
 * on the admin dashboard get them, and qa turns the gate off for everyone. The
 * build is not asked, so a build with a missing or unexpected environment
 * cannot open them by accident.
 *
 * Fails closed, like `useCardSpendModeAccess`: `false` until the request
 * answers, and `false` while the latest request has failed, even if an earlier
 * one said yes — so the screen lists what everyone is offered until the server
 * says otherwise.
 *
 * This gates OFFERING them on the deposit screen. A balance or receive in one is
 * still shown: the tokens go to the user's own Safe, which anyone can send to.
 */
export const useDepositTokensAccess = (): { isEnabled: boolean; isLoading: boolean } => {
  const { user } = useUser();

  const { data, isLoading, isError } = useQuery({
    queryKey: [DEPOSIT_TOKENS_ACCESS_QUERY_KEY, user?.userId],
    queryFn: getDepositTokensAccess,
    // Nothing to ask without a signed-in user, and the request would 401.
    enabled: !!user?.userId,
    staleTime: STALE_MS,
    retry: 1,
  });

  return {
    isEnabled: !isError && data?.enabled === true,
    isLoading: !!user?.userId && isLoading,
  };
};

export default useDepositTokensAccess;
