import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { SEND_MODAL } from '@/constants/modals';
import { USER } from '@/lib/config';
import mmkvStorage from '@/lib/mmvkStorage';
import { SendModal, TokenBalance, TransactionStatusModal } from '@/lib/types';

interface SendState {
  currentModal: SendModal;
  previousModal: SendModal;
  transaction: TransactionStatusModal;
  currentTokenAddress: string | null;
  selectedToken: TokenBalance | null;
  amount: string;
  address: string;
  name: string;
  setModal: (modal: SendModal) => void;
  setTransaction: (transaction: TransactionStatusModal) => void;
  setCurrentTokenAddress: (address: string) => void;
  setSelectedToken: (token: TokenBalance | null) => void;
  setAmount: (amount: string) => void;
  setAddress: (address: string) => void;
  setName: (name: string) => void;
  clearForm: () => void;
}

export const useSendStore = create<SendState>()(
  persist(
    (set, get) => ({
      currentModal: SEND_MODAL.CLOSE,
      previousModal: SEND_MODAL.CLOSE,
      transaction: {},
      currentTokenAddress: null,
      selectedToken: null,
      amount: '',
      address: '',
      name: '',

      setModal: modal =>
        set({
          previousModal: get().currentModal,
          currentModal: modal,
        }),
      setTransaction: transaction => set({ transaction }),
      setCurrentTokenAddress: address => set({ currentTokenAddress: address }),
      setSelectedToken: token => set({ selectedToken: token }),
      setAmount: amount => set({ amount }),
      setAddress: address => set({ address }),
      setName: name => set({ name }),
      clearForm: () =>
        set({
          selectedToken: null,
          amount: '',
          address: '',
          name: '',
        }),
    }),
    {
      name: USER.sendStorageKey,
      storage: createJSONStorage(() => mmkvStorage(USER.sendStorageKey)),
    },
  ),
);
