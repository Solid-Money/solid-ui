import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { USER } from '@/lib/config';
import mmkvStorage from '@/lib/mmvkStorage';
import { TransactionStatusModal, WithdrawModal } from '@/lib/types';
import { WITHDRAW_MODAL } from '@/constants/modals';

interface WithdrawState {
  currentModal: WithdrawModal;
  previousModal: WithdrawModal;
  transaction: TransactionStatusModal;
  setModal: (modal: WithdrawModal) => void;
  setTransaction: (transaction: TransactionStatusModal) => void;
}

export const useWithdrawStore = create<WithdrawState>()(
  persist(
    (set, get) => ({
      currentModal: WITHDRAW_MODAL.CLOSE,
      previousModal: WITHDRAW_MODAL.CLOSE,
      transaction: {},

      setModal: modal =>
        set({
          previousModal: get().currentModal,
          currentModal: modal,
        }),
      setTransaction: transaction => set({ transaction }),
    }),
    {
      name: USER.withdrawStorageKey,
      storage: createJSONStorage(() => mmkvStorage(USER.withdrawStorageKey)),
    },
  ),
);
