import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { CARD_DEPOSIT_MODAL } from '@/constants/modals';
import { USER } from '@/lib/config';
import mmkvStorage from '@/lib/mmvkStorage';

export enum CardDepositSource {
  WALLET = 'wallet',
  SAVINGS = 'savings',
  EXTERNAL = 'external',
  BORROW = 'borrow',
}

export interface CardDepositTransactionState {
  amount?: number;
}

interface CardDepositState {
  currentModal: { name: string; number: number };
  previousModal: { name: string; number: number };
  transaction: CardDepositTransactionState;
  source: CardDepositSource | undefined;
  setModal: (modal: { name: string; number: number }) => void;
  setTransaction: (tx: CardDepositTransactionState) => void;
  setSource: (src: CardDepositState['source']) => void;
}

export const useCardDepositStore = create<CardDepositState>()(
  persist(
    (set, get) => ({
      currentModal: CARD_DEPOSIT_MODAL.CLOSE,
      previousModal: CARD_DEPOSIT_MODAL.CLOSE,
      transaction: {},
      source: undefined,
      setModal: modal =>
        set({
          previousModal: get().currentModal,
          currentModal: modal,
        }),
      setTransaction: tx => set({ transaction: { ...get().transaction, ...tx } }),
      setSource: src => set({ source: src }),
    }),
    {
      name: USER.depositStorageKey + ':card',
      storage: createJSONStorage(() => mmkvStorage(USER.depositStorageKey + ':card')),
      partialize: state => ({ transaction: state.transaction, source: state.source }),
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
