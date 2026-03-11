import { create } from 'zustand';

import { CARD_WITHDRAW_MODAL } from '@/constants/modals';
import { CardDepositSource } from '@/store/useCardDepositStore';

export interface CardWithdrawTransactionState {
  amount?: number;
  clientTxId?: string;
  to?: CardDepositSource;
  /** Rain collateral withdrawal: tx hash and chain for explorer link */
  transactionHash?: string;
  chainId?: number;
}

interface CardWithdrawState {
  currentModal: { name: string; number: number };
  previousModal: { name: string; number: number };
  transaction: CardWithdrawTransactionState;
  setModal: (modal: { name: string; number: number }) => void;
  setTransaction: (tx: CardWithdrawTransactionState) => void;
}

export const useCardWithdrawStore = create<CardWithdrawState>()((set, get) => ({
  currentModal: CARD_WITHDRAW_MODAL.CLOSE,
  previousModal: CARD_WITHDRAW_MODAL.CLOSE,
  transaction: {},
  setModal: modal =>
    set({
      previousModal: get().currentModal,
      currentModal: modal,
    }),
  setTransaction: tx => set({ transaction: { ...get().transaction, ...tx } }),
}));
