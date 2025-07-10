import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { USER } from '@/lib/config';
import mmkvStorage from '@/lib/mmvkStorage';
import { DepositModal, DepositTransaction } from '@/lib/types';
import { DEPOSIT_MODAL } from '@/constants/modals';

interface DepositState {
  depositModal: DepositModal;
  previousDepositModal: DepositModal;
  transaction: DepositTransaction;
  setDepositModal: (modal: DepositModal) => void;
  setTransaction: (transaction: DepositTransaction) => void;
}

export const useDepositStore = create<DepositState>()(
  persist(
    (set, get) => ({
      depositModal: DEPOSIT_MODAL.CLOSE,
      previousDepositModal: DEPOSIT_MODAL.CLOSE,
      transaction: {},

      setDepositModal: (modal) => set({
        previousDepositModal: get().depositModal,
        depositModal: modal
      }),
      setTransaction: (transaction) => set({ transaction }),
    }),
    {
      name: USER.depositStorageKey,
      storage: createJSONStorage(() => mmkvStorage(USER.depositStorageKey)),
    }
  )
);
