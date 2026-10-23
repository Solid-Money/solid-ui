import { useQuery } from '@tanstack/react-query';

import useUser from '@/hooks/useUser';
import { getEurVaultAccess } from '@/lib/api';
import { isDevFeatureEnabled } from '@/lib/config';
import { VaultType } from '@/lib/types';

export const EUR_VAULT_ACCESS_QUERY_KEY = 'eurVaultAccess';

/** How long the gate is trusted before it is asked again. */
const STALE_MS = 5 * 60 * 1000;

/**
 * Whether this user may be offered the EUR vault (soEURC on Base).
 *
 * QA and preview builds offer it to everyone, as they always have. Production offers it only to
 * the Wirex test users while the backend gates it (`EUR_VAULT_COHORT_ONLY`), and that cohort is a
 * Mongo collection, so the answer comes from the server rather than from the build.
 *
 * Fails closed, like `useCardSpendModeAccess`: `false` until the request answers and `false` if
 * it fails, so the vault never flashes into view for someone who is not in the cohort.
 *
 * This gates OFFERING the vault — the Earn row, the savings vault list, the deposit picker, the
 * deep link. A soEURC already in a wallet is still recognised and can still be withdrawn.
 */
export const useEurVaultAccess = (): { isEnabled: boolean; isLoading: boolean } => {
  const { user } = useUser();

  const { data, isLoading } = useQuery({
    queryKey: [EUR_VAULT_ACCESS_QUERY_KEY, user?.userId],
    queryFn: getEurVaultAccess,
    // Nothing to ask without a signed-in user (the request would 401), and nothing to ask on a
    // build that offers the vault to everyone.
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

/** Whether a vault of this type may be offered: every vault but EUR, and EUR only with access. */
export const isVaultOffered = (type: VaultType, isEurVaultEnabled: boolean): boolean =>
  type !== VaultType.EUR || isEurVaultEnabled;

export default useEurVaultAccess;
