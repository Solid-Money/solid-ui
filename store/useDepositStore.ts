import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { USER } from '@/lib/config';
import mmkvStorage from '@/lib/mmvkStorage';
import { DepositModal, TransactionStatusModal } from '@/lib/types';
import { DEPOSIT_MODAL } from '@/constants/modals';

interface DepositState {
  currentModal: DepositModal;
  previousModal: DepositModal;
  transaction: TransactionStatusModal;
  setModal: (modal: DepositModal) => void;
  setTransaction: (transaction: TransactionStatusModal) => void;
}

export const useDepositStore = create<DepositState>()(
  persist(
    (set, get) => ({
      currentModal: DEPOSIT_MODAL.CLOSE,
      previousModal: DEPOSIT_MODAL.CLOSE,
      transaction: {},

      setModal: (modal) => set({
        previousModal: get().currentModal,
        currentModal: modal
      }),
      setTransaction: (transaction) => set({ transaction }),
    }),
    {
      name: USER.depositStorageKey,
      storage: createJSONStorage(() => mmkvStorage(USER.depositStorageKey)),
    }
  )
);
