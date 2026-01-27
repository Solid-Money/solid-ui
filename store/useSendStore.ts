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
  searchQuery: string;
  setModal: (modal: SendModal) => void;
  setTransaction: (transaction: TransactionStatusModal) => void;
  setCurrentTokenAddress: (address: string) => void;
  setSelectedToken: (token: TokenBalance | null) => void;
  setAmount: (amount: string) => void;
  setAddress: (address: string) => void;
  setName: (name: string) => void;
  setSearchQuery: (query: string) => void;
  clearForm: () => void;
  resetAll: () => void;
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
      searchQuery: '',

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
      setSearchQuery: query => set({ searchQuery: query }),
      clearForm: () =>
        set({
          selectedToken: null,
          currentTokenAddress: null,
          transaction: {},
          amount: '',
          address: '',
          name: '',
          searchQuery: '',
        }),
      resetAll: () =>
        set({
          currentModal: SEND_MODAL.CLOSE,
          previousModal: SEND_MODAL.CLOSE,
          transaction: {},
          currentTokenAddress: null,
          selectedToken: null,
          amount: '',
          address: '',
          name: '',
          searchQuery: '',
        }),
    }),
    {
      name: USER.sendStorageKey,
      storage: createJSONStorage(() => mmkvStorage(USER.sendStorageKey)),
    },
  ),
);

/**
 * Check if there is unsaved data in the send form.
 * Used to determine if a discard confirmation dialog should be shown.
 */
export const hasUnsavedSendData = (): boolean => {
  const state = useSendStore.getState();
  return !!(state.amount || state.address || state.selectedToken || state.name);
};
