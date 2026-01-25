import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { USER } from '@/lib/config';
import mmkvStorage from '@/lib/mmvkStorage';

interface RewardsState {
  selectedTierModalId: string | null;
  setSelectedTierModalId: (tier: string | null) => void;
}

export const useRewards = create<RewardsState>()(
  persist(
    set => ({
      selectedTierModalId: null,
      setSelectedTierModalId: (tier: string | null) => set({ selectedTierModalId: tier }),
    }),
    {
      name: USER.rewardsStorageKey,
      storage: createJSONStorage(() => mmkvStorage(USER.rewardsStorageKey)),
      partialize: () => ({}),
    },
  ),
);
