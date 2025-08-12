import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { USER } from '@/lib/config';
import mmkvStorage from '@/lib/mmvkStorage';
import { TransactionStatusModal, UnstakeModal } from '@/lib/types';
import { UNSTAKE_MODAL } from '@/constants/modals';

interface UnstakeState {
  currentModal: UnstakeModal;
  previousModal: UnstakeModal;
  transaction: TransactionStatusModal;
  setModal: (modal: UnstakeModal) => void;
  setTransaction: (transaction: TransactionStatusModal) => void;
}

export const useUnstakeStore = create<UnstakeState>()(
  persist(
    (set, get) => ({
      currentModal: UNSTAKE_MODAL.CLOSE,
      previousModal: UNSTAKE_MODAL.CLOSE,
      transaction: {},

      setModal: modal =>
        set({
          previousModal: get().currentModal,
          currentModal: modal,
        }),
      setTransaction: transaction => set({ transaction }),
    }),
    {
      name: USER.unstakeStorageKey,
      storage: createJSONStorage(() => mmkvStorage(USER.unstakeStorageKey)),
    },
  ),
);
