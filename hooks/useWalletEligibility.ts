import { useQuery } from '@tanstack/react-query';

import { isDummyUserId } from '@/constants/dummyCard';
import { useCardProvider } from '@/hooks/useCardProvider';
import { getWalletEligibility } from '@/lib/api';
import { CardProvider } from '@/lib/types';
import { withRefreshToken } from '@/lib/utils';
import { useUserStore } from '@/store/useUserStore';

export const WALLET_ELIGIBILITY_KEY = 'walletEligibility';

/**
 * Push-provisioning eligibility for the current card, including whether the card
 * is already in the user's Apple/Google wallet.
 *
 * @param enabled skip the request when the answer can't matter (no card yet, or
 * the caller isn't showing a wallet prompt).
 */
export function useWalletEligibility(enabled = true) {
  const userId = useUserStore(state => state.users.find(user => user.selected)?.userId);
  const { provider } = useCardProvider();

  return useQuery({
    queryKey: [WALLET_ELIGIBILITY_KEY, userId, provider],
    queryFn: () => withRefreshToken(() => getWalletEligibility()),
    // The endpoint is Rain-only. Preview cards have no matching backend card,
    // and Wirex uses its own wallet flow; neither should make this request.
    enabled: enabled && !!userId && !isDummyUserId(userId) && provider === CardProvider.RAIN,
    staleTime: 60 * 1000,
  });
}
