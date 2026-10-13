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
  /**
   * While set, a tier purchase — a lock or an annual fee — has landed and the
   * rewards payload is polled until the new tier shows up or this passes.
   *
   * Only a purchase arms it. Savings deposits, yield-boost claims and balance
   * events used to as well, back when FUSE held in savings could move a tier;
   * none of them can now, so the window they opened always ran out — and
   * ended on a "no higher tier has been confirmed" notice over a screen where
   * the user had only claimed a payout.
   */
  pendingUntil?: number;
  selectAccount: (userId?: string) => void;
  observe: (userId: string, session: number, data: RewardsUserData) => void;
  tierPurchased: (userId: string) => void;
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
} as const;

// Transient and global: one popup per observed promotion, even when several
// screens consume the rewards query. Account switches discard the baseline.
export const useRewardsUpgradeStore = create<RewardsUpgradeState>((set, get) => ({
  userId: selectedRewardsUserId(),
  session: 0,
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
      ...(promoted ? { pendingUntil: undefined } : {}),
    });
  },
  tierPurchased: userId => {
    if (get().userId !== userId) return;
    set({ pendingUntil: get().pendingUntil ?? Date.now() + REWARDS_RECONCILIATION_MS });
  },
  // Ends quietly. A purchase is confirmed on chain before this opens, so a
  // window that runs out means the tier is slow to show, not that it failed —
  // and the tier it bought may be one the user already had (keeping a trial).
  finishWaiting: () => set({ pendingUntil: undefined }),
  dismiss: () => set({ success: undefined }),
}));

useUserStore.subscribe(() => {
  useRewardsUpgradeStore.getState().selectAccount(selectedRewardsUserId());
});
