import { create } from 'zustand';

import { isHigherTier, REWARDS_RECONCILIATION_MS } from '@/lib/rewardsUpgrade';
import { RewardsTier, RewardsUserData } from '@/lib/types';
import { useUserStore } from '@/store/useUserStore';

export const selectedRewardsUserId = () =>
  useUserStore.getState().users.find(user => user.selected)?.userId;

interface RewardsUpgradeState {
  userId?: string;
  session: number;
  confirmed?: RewardsUserData;
  /**
   * The highest tier seen this session, which is what a promotion is measured
   * against.
   *
   * Not `confirmed.currentTier`. The backend re-derives the tier from a lock, a
   * subscription row and a soFUSE balance it caches for a minute, so a read
   * taken mid-reconciliation can come back a tier low and the next one put it
   * back — and against the *last* tier that recovery reads as a promotion. That
   * is the "You're on Prime now!" card appearing over a screen where nothing
   * was bought. Against the *highest* tier, it reads as what it is: nothing
   * happened.
   */
  peak?: RewardsTier;
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

/**
 * Everything an account switch discards, in one place.
 *
 * Exported so a test setting up a fresh account can spread it rather than list
 * the fields: a field added here and missed there leaks between tests, and a
 * leaked `peak` is a promotion that silently stops being observed.
 */
export const REWARDS_UPGRADE_CLEARED_STATE = {
  confirmed: undefined,
  peak: undefined,
  success: undefined,
  pendingUntil: undefined,
  timedOut: false,
  savingsConfirmed: false,
} as const;

// Transient and global: one popup per observed promotion, even when several
// screens consume the rewards query. Account switches discard the baseline.
export const useRewardsUpgradeStore = create<RewardsUpgradeState>((set, get) => ({
  userId: selectedRewardsUserId(),
  session: 0,
  timedOut: false,
  savingsConfirmed: false,
  selectAccount: userId => {
    if (userId === get().userId) return;
    set({ userId, session: get().session + 1, ...REWARDS_UPGRADE_CLEARED_STATE });
  },
  observe: (userId, session, data) => {
    const state = get();
    if (state.userId !== userId || state.session !== session) return;
    const promoted = isHigherTier(data.currentTier, state.peak);
    set({
      confirmed: data,
      peak: promoted ? data.currentTier : (state.peak ?? data.currentTier),
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
