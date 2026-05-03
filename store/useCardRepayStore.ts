import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { CARD_REPAY_MODAL } from '@/constants/modals';
import { USER } from '@/lib/config';
import mmkvStorage from '@/lib/mmvkStorage';
import { TokenBalance } from '@/lib/types';

export enum CardRepaySource {
  WALLET = 'wallet',
  COLLATERAL = 'collateral',
}

export interface CardRepayTransactionState {
  amount?: number;
}

interface CardRepayState {
  currentModal: { name: string; number: number };
  previousModal: { name: string; number: number };
  transaction: CardRepayTransactionState;
  selectedToken: TokenBalance | null;
  source: CardRepaySource;
  setModal: (modal: { name: string; number: number }) => void;
  setTransaction: (tx: CardRepayTransactionState) => void;
  setSelectedToken: (token: TokenBalance | null) => void;
  setSource: (source: CardRepaySource) => void;
}

export const useCardRepayStore = create<CardRepayState>()(
  persist(
    (set, get) => ({
      currentModal: CARD_REPAY_MODAL.CLOSE,
      previousModal: CARD_REPAY_MODAL.CLOSE,
      transaction: {},
      selectedToken: null,
      source: CardRepaySource.WALLET,
      setModal: modal =>
        set({
          previousModal: get().currentModal,
          currentModal: modal,
        }),
      setTransaction: tx => set({ transaction: { ...get().transaction, ...tx } }),
      setSelectedToken: token => set({ selectedToken: token }),
      setSource: source => set({ source }),
    }),
    {
      name: USER.depositStorageKey + ':card:repay',
      storage: createJSONStorage(() => mmkvStorage(USER.depositStorageKey + ':card:repay')),
      partialize: state => ({
        transaction: state.transaction,
        selectedToken: state.selectedToken,
        source: state.source,
      }),
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
