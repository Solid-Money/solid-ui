import { mainnet } from 'viem/chains';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import {
  BridgeTransferCryptoCurrency,
  BridgeTransferFiatCurrency,
} from '@/components/BankTransfer/enums';
import { DEPOSIT_MODAL } from '@/constants/modals';
import { USER } from '@/lib/config';
import mmkvStorage from '@/lib/mmvkStorage';
import { DepositModal, TransactionStatusModal } from '@/lib/types';

interface BankTransferData {
  fiatAmount?: string;
  cryptoAmount?: string;
  fiat?: BridgeTransferFiatCurrency;
  crypto?: BridgeTransferCryptoCurrency;
  method?: string;
  instructions?: any;
}

interface DepositState {
  currentModal: DepositModal;
  previousModal: DepositModal;
  transaction: TransactionStatusModal;
  srcChainId: number;
  bankTransfer: BankTransferData;
  setModal: (modal: DepositModal) => void;
  setTransaction: (transaction: TransactionStatusModal) => void;
  setBankTransferData: (data: Partial<BankTransferData>) => void;
  clearBankTransferData: () => void;
  setSrcChainId: (srcChainId: number) => void;
}

export const useDepositStore = create<DepositState>()(
  persist(
    (set, get) => ({
      currentModal: DEPOSIT_MODAL.CLOSE,
      previousModal: DEPOSIT_MODAL.CLOSE,
      transaction: {},
      srcChainId: mainnet.id,
      bankTransfer: {},

      setModal: modal =>
        set({
          previousModal: get().currentModal,
          currentModal: modal,
        }),
      setTransaction: transaction => set({ transaction }),
      setBankTransferData: data => set({ bankTransfer: { ...get().bankTransfer, ...data } }),
      clearBankTransferData: () => set({ bankTransfer: {} }),
      setSrcChainId: srcChainId => set({ srcChainId }),
    }),
    {
      name: USER.depositStorageKey,
      storage: createJSONStorage(() => mmkvStorage(USER.depositStorageKey)),
      // Do not persist modal open state
      partialize: state => ({
        transaction: state.transaction,
        srcChainId: state.srcChainId,
        bankTransfer: state.bankTransfer,
      }),
      // Ignore any legacy stored modal fields
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
