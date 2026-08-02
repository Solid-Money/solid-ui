import { useQuery } from '@tanstack/react-query';

import { getWalletEligibility } from '@/lib/api';
import { withRefreshToken } from '@/lib/utils';

export const WALLET_ELIGIBILITY_KEY = 'walletEligibility';

/**
 * Push-provisioning eligibility for the current card, including whether the card
 * is already in the user's Apple/Google wallet.
 *
 * @param enabled skip the request when the answer can't matter (no card yet, or
 * the caller isn't showing a wallet prompt).
 */
export function useWalletEligibility(enabled = true) {
  return useQuery({
    queryKey: [WALLET_ELIGIBILITY_KEY],
    queryFn: () => withRefreshToken(() => getWalletEligibility()),
    enabled,
    staleTime: 60 * 1000,
  });
}
