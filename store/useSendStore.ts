import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { USER } from '@/lib/config';
import mmkvStorage from '@/lib/mmvkStorage';
import { SendModal, TransactionStatusModal } from '@/lib/types';
import { SEND_MODAL } from '@/constants/modals';

interface SendState {
  currentModal: SendModal;
  previousModal: SendModal;
  transaction: TransactionStatusModal;
  currentTokenAddress: string | null;
  setModal: (modal: SendModal) => void;
  setTransaction: (transaction: TransactionStatusModal) => void;
  setCurrentTokenAddress: (address: string) => void;
}

export const useSendStore = create<SendState>()(
  persist(
    (set, get) => ({
      currentModal: SEND_MODAL.CLOSE,
      previousModal: SEND_MODAL.CLOSE,
      transaction: {},
      currentTokenAddress: null,

      setModal: (modal) => set({
        previousModal: get().currentModal,
        currentModal: modal
      }),
      setTransaction: (transaction) => set({ transaction }),
      setCurrentTokenAddress: (address) => set({ currentTokenAddress: address }),
    }),
    {
      name: USER.sendStorageKey,
      storage: createJSONStorage(() => mmkvStorage(USER.sendStorageKey)),
    }
  )
);
