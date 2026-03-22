import { create } from 'zustand';

import { WITHDRAW_MODAL } from '@/constants/modals';
import { TransactionStatusModal, WithdrawModal } from '@/lib/types';

interface WithdrawState {
  currentModal: WithdrawModal;
  previousModal: WithdrawModal;
  transaction: TransactionStatusModal;
  setModal: (modal: WithdrawModal) => void;
  setTransaction: (transaction: TransactionStatusModal) => void;
}

export const useWithdrawStore = create<WithdrawState>()((set, get) => ({
  currentModal: WITHDRAW_MODAL.CLOSE,
  previousModal: WITHDRAW_MODAL.CLOSE,
  transaction: {},

  setModal: modal =>
    set({
      previousModal: get().currentModal,
      currentModal: modal,
    }),
  setTransaction: transaction => set({ transaction }),
}));
