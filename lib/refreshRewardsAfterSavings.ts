import { QueryClient } from '@tanstack/react-query';

import { selectedRewardsUserId } from '@/store/useRewardsUpgradeStore';

/**
 * The tier membership's query family — `TIER_MEMBERSHIP_QUERY_KEY` in
 * `hooks/useTierMembership`, repeated here so this module stays free of that
 * hook's wallet and transaction imports.
 */
const TIER_MEMBERSHIP_QUERY_FAMILY = 'tierMembership';

/**
 * Refetch what a savings balance change makes stale: the rewards payload, the
 * tier membership (its "Hold in Earn" route is measured off the Earn balance)
 * and the account's balances.
 *
 * It does not wait for a promotion. Only a lock or an annual fee raises a tier
 * on the spot — see `tierPurchased`; the Earn balance unlocks one only at the
 * backend's evaluation, days later — so polling after a deposit or a claim only
 * ever ran out, and told the user no higher tier had been confirmed.
 */
export const refreshRewardsAfterSavings = (
  queryClient: QueryClient,
  userId: string,
  safeAddress?: string,
) => {
  if (selectedRewardsUserId() !== userId) return;
  void queryClient.invalidateQueries({ queryKey: ['rewards', 'userData', userId] });
  void queryClient.invalidateQueries({ queryKey: [TIER_MEMBERSHIP_QUERY_FAMILY, userId] });
  if (safeAddress) {
    const address = safeAddress.toLowerCase();
    void queryClient.invalidateQueries({
      predicate: query =>
        ['vault', 'tokenBalances', 'balance', 'readContract'].includes(String(query.queryKey[0])) &&
        JSON.stringify(query.queryKey).toLowerCase().includes(address),
    });
  }
};
