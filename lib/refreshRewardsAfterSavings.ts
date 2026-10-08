import { QueryClient } from '@tanstack/react-query';

import { selectedRewardsUserId } from '@/store/useRewardsUpgradeStore';

/**
 * Refetch what a savings balance change makes stale: the rewards payload and
 * the account's balances.
 *
 * It does not wait for a promotion. Only a lock or an annual fee raises a tier
 * now — see `tierPurchased` — so polling after a deposit or a claim only ever
 * ran out, and told the user no higher tier had been confirmed.
 */
export const refreshRewardsAfterSavings = (
  queryClient: QueryClient,
  userId: string,
  safeAddress?: string,
) => {
  if (selectedRewardsUserId() !== userId) return;
  void queryClient.invalidateQueries({ queryKey: ['rewards', 'userData', userId] });
  if (safeAddress) {
    const address = safeAddress.toLowerCase();
    void queryClient.invalidateQueries({
      predicate: query =>
        ['vault', 'tokenBalances', 'balance', 'readContract'].includes(String(query.queryKey[0])) &&
        JSON.stringify(query.queryKey).toLowerCase().includes(address),
    });
  }
};
