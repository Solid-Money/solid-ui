import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { USER } from '@/lib/config';
import mmkvStorage from '@/lib/mmvkStorage';

interface BalanceState {
  earnedUSD: number;
  setEarnedUSD: (earnedUSD: number) => void;
  clearBalance: () => void;
}

export const useBalanceStore = create<BalanceState>()(
  persist(
    (set) => ({
      earnedUSD: 0,

      setEarnedUSD: earnedUSD => set({ earnedUSD }),

      clearBalance: () => set({
        earnedUSD: 0,
      }),
    }),
    {
      name: USER.balanceStorageKey,
      storage: createJSONStorage(() => mmkvStorage(USER.balanceStorageKey)),
    },
  ),
);
