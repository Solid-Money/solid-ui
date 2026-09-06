import { create } from 'zustand';

import { isHigherTier, REWARDS_RECONCILIATION_MS } from '@/lib/rewardsUpgrade';
import { RewardsUserData } from '@/lib/types';
import { useUserStore } from '@/store/useUserStore';

export const selectedRewardsUserId = () =>
  useUserStore.getState().users.find(user => user.selected)?.userId;

interface RewardsUpgradeState {
  userId?: string;
  session: number;
  confirmed?: RewardsUserData;
  success?: RewardsUserData;
  pendingUntil?: number;
  savingsConfirmed: boolean;
  timedOut: boolean;
  selectAccount: (userId?: string) => void;
  observe: (userId: string, session: number, data: RewardsUserData) => void;
  savingsChanged: (userId: string, confirmedSavings?: boolean) => void;
  finishWaiting: () => void;
  dismiss: () => void;
}

// Transient and global: one popup per observed promotion, even when several
// screens consume the rewards query. Account switches discard the baseline.
export const useRewardsUpgradeStore = create<RewardsUpgradeState>((set, get) => ({
  userId: selectedRewardsUserId(),
  session: 0,
  timedOut: false,
  savingsConfirmed: false,
  selectAccount: userId => {
    if (userId === get().userId) return;
    set({
      userId,
      session: get().session + 1,
      confirmed: undefined,
      success: undefined,
      pendingUntil: undefined,
      timedOut: false,
      savingsConfirmed: false,
    });
  },
  observe: (userId, session, data) => {
    const state = get();
    if (state.userId !== userId || state.session !== session) return;
    const promoted = isHigherTier(data.currentTier, state.confirmed?.currentTier);
    set({
      confirmed: data,
      success: promoted
        ? data
        : state.success?.currentTier === data.currentTier
          ? state.success
          : undefined,
      ...(promoted ? { pendingUntil: undefined, timedOut: false, savingsConfirmed: false } : {}),
    });
  },
  savingsChanged: (userId, confirmedSavings = true) => {
    if (get().userId !== userId) return;
    set({
      pendingUntil: get().pendingUntil ?? Date.now() + REWARDS_RECONCILIATION_MS,
      savingsConfirmed: get().savingsConfirmed || confirmedSavings,
      timedOut: false,
    });
  },
  finishWaiting: () =>
    set({ pendingUntil: undefined, timedOut: get().savingsConfirmed, savingsConfirmed: false }),
  dismiss: () => set({ success: undefined, timedOut: false }),
}));

useUserStore.subscribe(() => {
  useRewardsUpgradeStore.getState().selectAccount(selectedRewardsUserId());
});
