import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import mmkvStorage from '@/lib/mmvkStorage';

interface RewardsIntroState {
  /** Accounts that completed all three Rewards explainer slides. */
  completedByUserId: Record<string, boolean>;
  complete: (userId: string) => void;
}

const REWARDS_INTRO_STORAGE_KEY = 'rewards-intro-storage';

/**
 * Remembers explainer completion per account on this device. The backend opt-in
 * flag remains the source of truth for joining the program; this store only
 * prevents the introductory slides from replaying on every visit.
 */
export const useRewardsIntroStore = create<RewardsIntroState>()(
  persist(
    set => ({
      completedByUserId: {},
      complete: userId =>
        set(state => ({
          completedByUserId: { ...state.completedByUserId, [userId]: true },
        })),
    }),
    {
      name: REWARDS_INTRO_STORAGE_KEY,
      storage: createJSONStorage(() => mmkvStorage(REWARDS_INTRO_STORAGE_KEY)),
    },
  ),
);
