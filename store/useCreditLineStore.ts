import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { CREDIT_LINE_MODAL } from '@/constants/modals';
import { USER } from '@/lib/config';
import mmkvStorage from '@/lib/mmvkStorage';

export interface CreditLineTransactionState {
  /** Amount borrowed (USDC) in the current flow. */
  amount?: number;
}

interface CreditLineState {
  currentModal: { name: string; number: number };
  previousModal: { name: string; number: number };
  transaction: CreditLineTransactionState;
  setModal: (modal: { name: string; number: number }) => void;
  setTransaction: (tx: CreditLineTransactionState) => void;
}

export const useCreditLineStore = create<CreditLineState>()(
  persist(
    (set, get) => ({
      currentModal: CREDIT_LINE_MODAL.CLOSE,
      previousModal: CREDIT_LINE_MODAL.CLOSE,
      transaction: {},
      setModal: modal =>
        set({
          previousModal: get().currentModal,
          currentModal: modal,
        }),
      setTransaction: tx => set({ transaction: { ...get().transaction, ...tx } }),
    }),
    {
      name: USER.depositStorageKey + ':card:credit-line',
      storage: createJSONStorage(() => mmkvStorage(USER.depositStorageKey + ':card:credit-line')),
      partialize: state => ({ transaction: state.transaction }),
      merge: (persisted, current) => {
        const next = { ...current, ...(persisted as any) };
        return {
          ...next,
          currentModal: current.currentModal,
          previousModal: current.previousModal,
        };
      },
    },
  ),
);
