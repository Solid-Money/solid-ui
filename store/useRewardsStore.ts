import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { USER } from '@/lib/config';
import mmkvStorage from '@/lib/mmvkStorage';
import { RewardsTier } from '@/lib/types';

interface RewardsState {
  selectedTierModalId: RewardsTier | null;
  setSelectedTierModalId: (tier: RewardsTier | null) => void;
}

export const useRewards = create<RewardsState>()(
  persist(
    set => ({
      selectedTierModalId: null,
      setSelectedTierModalId: (tier: RewardsTier | null) => set({ selectedTierModalId: tier }),
    }),
    {
      name: USER.rewardsStorageKey,
      storage: createJSONStorage(() => mmkvStorage(USER.rewardsStorageKey)),
      partialize: () => ({}),
    },
  ),
);
