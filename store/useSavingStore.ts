import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { USER } from '@/lib/config';
import mmkvStorage from '@/lib/mmvkStorage';

interface SavingState {
  selectedVault: number;
  setSelectedVault: (vault: number) => void;
}

export const useSavingStore = create<SavingState>()(
  persist(
    (set) => ({
      selectedVault: 0,

      setSelectedVault: vault =>
        set({
          selectedVault: vault,
        }),
    }),
    {
      name: USER.savingStorageKey,
      storage: createJSONStorage(() => mmkvStorage(USER.savingStorageKey)),
    },
  ),
);
