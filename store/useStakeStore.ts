import { create } from 'zustand';

import { STAKE_MODAL } from '@/constants/modals';
import { StakeModal, TransactionStatusModal } from '@/lib/types';

interface StakeState {
  currentModal: StakeModal;
  previousModal: StakeModal;
  transaction: TransactionStatusModal;
  setModal: (modal: StakeModal) => void;
  setTransaction: (transaction: TransactionStatusModal) => void;
}

export const useStakeStore = create<StakeState>()((set, get) => ({
  currentModal: STAKE_MODAL.CLOSE,
  previousModal: STAKE_MODAL.CLOSE,
  transaction: {},

  setModal: modal =>
    set({
      previousModal: get().currentModal,
      currentModal: modal,
    }),
  setTransaction: transaction => set({ transaction }),
}));
