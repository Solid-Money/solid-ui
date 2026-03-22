import { create } from 'zustand';

import { DEPOSIT_FROM_SAFE_ACCOUNT_MODAL } from '@/constants/modals';
import { DepositFromSafeAccountModal, TransactionStatusModal } from '@/lib/types';

interface DepositFromSafeAccountState {
  currentModal: DepositFromSafeAccountModal;
  previousModal: DepositFromSafeAccountModal;
  transaction: TransactionStatusModal;
  setModal: (modal: DepositFromSafeAccountModal) => void;
  setTransaction: (transaction: TransactionStatusModal) => void;
}

export const useDepositFromSafeAccountStore = create<DepositFromSafeAccountState>()((set, get) => ({
  currentModal: DEPOSIT_FROM_SAFE_ACCOUNT_MODAL.CLOSE,
  previousModal: DEPOSIT_FROM_SAFE_ACCOUNT_MODAL.CLOSE,
  transaction: {},

  setModal: modal =>
    set({
      previousModal: get().currentModal,
      currentModal: modal,
    }),
  setTransaction: transaction => set({ transaction }),
}));
