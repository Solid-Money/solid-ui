import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import mmkvStorage from '@/lib/mmvkStorage';
import { acknowledgeRewardMarks, type RewardMarks, type SeenRewardMarks } from '@/lib/rewardsSeen';

interface RewardsSeenState {
  /** Per account: the newest reward of each source the user has seen, or been shown. */
  seenByUserId: Record<string, SeenRewardMarks>;
  /** Moves an account's seen marks up to `marks` (see `acknowledgeRewardMarks`). */
  acknowledge: (userId: string, marks: RewardMarks) => void;
}

const REWARDS_SEEN_STORAGE_KEY = 'rewards-seen-storage';

/**
 * The rewards the Rewards tab's pop has already announced, per account on this
 * device — so a credit pops the tab icon once, rather than on every launch
 * until the tab is opened.
 */
export const useRewardsSeenStore = create<RewardsSeenState>()(
  persist(
    (set, get) => ({
      seenByUserId: {},
      acknowledge: (userId, marks) => {
        const next = acknowledgeRewardMarks(get().seenByUserId[userId], marks);
        if (!next) return;
        set(state => ({ seenByUserId: { ...state.seenByUserId, [userId]: next } }));
      },
    }),
    {
      name: REWARDS_SEEN_STORAGE_KEY,
      storage: createJSONStorage(() => mmkvStorage(REWARDS_SEEN_STORAGE_KEY)),
    },
  ),
);
