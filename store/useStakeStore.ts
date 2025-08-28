import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { STAKE_MODAL } from '@/constants/modals';
import { USER } from '@/lib/config';
import mmkvStorage from '@/lib/mmvkStorage';
import { StakeModal, TransactionStatusModal } from '@/lib/types';

interface StakeState {
  currentModal: StakeModal;
  previousModal: StakeModal;
  transaction: TransactionStatusModal;
  setModal: (modal: StakeModal) => void;
  setTransaction: (transaction: TransactionStatusModal) => void;
}

export const useStakeStore = create<StakeState>()(
  persist(
    (set, get) => ({
      currentModal: STAKE_MODAL.CLOSE,
      previousModal: STAKE_MODAL.CLOSE,
      transaction: {},

      setModal: modal =>
        set({
          previousModal: get().currentModal,
          currentModal: modal,
        }),
      setTransaction: transaction => set({ transaction }),
    }),
    {
      name: USER.stakeStorageKey,
      storage: createJSONStorage(() => mmkvStorage(USER.stakeStorageKey)),
    },
  ),
);
