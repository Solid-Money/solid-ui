import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { DEPOSIT_MODAL } from '@/constants/modals';
import { USER } from '@/lib/config';
import mmkvStorage from '@/lib/mmvkStorage';
import { useDepositStore } from '@/store/useDepositStore';

interface SavingState {
  selectedVault: number;
  setSelectedVault: (vault: number) => void;
  selectVaultForDeposit: (vault: number) => void;
}

export const useSavingStore = create<SavingState>()(
  persist(
    (set) => ({
      selectedVault: 0,

      setSelectedVault: vault => {
        const { setModal, resetDepositFlow } = useDepositStore.getState();
        setModal(DEPOSIT_MODAL.CLOSE);
        resetDepositFlow();
        set({ selectedVault: vault });
      },

      selectVaultForDeposit: vault => {
        set({ selectedVault: vault });
      },
    }),
    {
      name: USER.savingStorageKey,
      storage: createJSONStorage(() => mmkvStorage(USER.savingStorageKey)),
    },
  ),
);
