import { useQuery } from '@tanstack/react-query';

import useUser from '@/hooks/useUser';
import { getWalletTopUpAvailability } from '@/lib/api';
import { withRefreshToken } from '@/lib/utils';

import type { WalletTopUpAvailability, WalletTopUpSdkConfig } from '@/lib/types/wallet-topup';

export const WALLET_TOPUP_AVAILABILITY_QUERY_KEY = 'walletTopUpAvailability';

/** How long the answer is trusted before it is asked again. */
const STALE_MS = 5 * 60 * 1000;

/**
 * Whether this user may top up with Apple Pay / Google Pay, and what Wirex's
 * checkout needs to load.
 *
 * The server decides: while `WALLET_TOPUP_COHORT_ONLY` gates it, only internal
 * team members tagged `wallet_topup` on the admin dashboard get it, and a
 * Wirex-verified user without an active `WalletTopup` capability never does.
 *
 * Fails closed, like `useDepositTokensAccess`: not available until the request
 * answers, and not available while the latest request has failed, even if an
 * earlier one said yes.
 *
 * `checkoutSdk` is the exception, for a checkout already on screen: the SDK config
 * of the last answer that arrived, kept through a failed refetch (React Query
 * keeps the last good data on error), so a network blip does not pull the
 * checkout out from under a payment. Offering the row reads `isAvailable` only.
 */
export const useWalletTopUpAvailability = (): {
  availability: WalletTopUpAvailability | undefined;
  isAvailable: boolean;
  isLoading: boolean;
  checkoutSdk: WalletTopUpSdkConfig | undefined;
  refetch: () => Promise<unknown>;
} => {
  const { user } = useUser();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: [WALLET_TOPUP_AVAILABILITY_QUERY_KEY, user?.userId],
    queryFn: () => withRefreshToken(getWalletTopUpAvailability),
    // Nothing to ask without a signed-in user, and the request would 401.
    enabled: !!user?.userId,
    staleTime: STALE_MS,
    retry: 1,
  });

  const isAvailable = !isError && data?.available === true && !!data.sdk;

  return {
    availability: isAvailable ? data : undefined,
    isAvailable,
    isLoading: !!user?.userId && isLoading,
    checkoutSdk: data?.sdk ?? undefined,
    refetch,
  };
};

export default useWalletTopUpAvailability;
