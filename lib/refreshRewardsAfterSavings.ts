import { QueryClient } from '@tanstack/react-query';

import { selectedRewardsUserId, useRewardsUpgradeStore } from '@/store/useRewardsUpgradeStore';

export const refreshRewardsAfterSavings = (
  queryClient: QueryClient,
  userId: string,
  safeAddress?: string,
  confirmedSavings = true,
) => {
  if (selectedRewardsUserId() !== userId) return;
  useRewardsUpgradeStore.getState().savingsChanged(userId, confirmedSavings);
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
