import { create } from 'zustand';

import { SEND_MODAL } from '@/constants/modals';
import { SendModal, TokenBalance, TransactionStatusModal } from '@/lib/types';
import { CrossChainSendQuote, CrossChainSendRecord } from '@/lib/types/cross-chain-send';

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
  /**
   * Cross-chain send: the flow was opened on a bridgeable Fuse token, so a
   * picked recipient goes to the network step instead of the regular form.
   */
  isCrossChain: boolean;
  /** Cross-chain send: the network the recipient receives on. */
  destinationChainId: number | null;
  /** Cross-chain send: the quote the Review step shows and the voucher is priced against. */
  crossChainQuote: CrossChainSendQuote | null;
  /** Cross-chain send: the authorised send, tracked on the "On its way" screen. */
  crossChainSend: CrossChainSendRecord | null;
  setModal: (modal: SendModal) => void;
  setTransaction: (transaction: TransactionStatusModal) => void;
  setCurrentTokenAddress: (address: string) => void;
  setSelectedToken: (token: TokenBalance | null) => void;
  setAmount: (amount: string) => void;
  setAddress: (address: string) => void;
  setName: (name: string) => void;
  setSearchQuery: (query: string) => void;
  setIsCrossChain: (isCrossChain: boolean) => void;
  setDestinationChainId: (chainId: number | null) => void;
  setCrossChainQuote: (quote: CrossChainSendQuote | null) => void;
  setCrossChainSend: (send: CrossChainSendRecord | null) => void;
  clearForm: () => void;
  resetAll: () => void;
}

const EMPTY_FORM = {
  transaction: {},
  currentTokenAddress: null,
  selectedToken: null,
  amount: '',
  address: '',
  name: '',
  searchQuery: '',
  isCrossChain: false,
  destinationChainId: null,
  crossChainQuote: null,
  crossChainSend: null,
};

export const useSendStore = create<SendState>()((set, get) => ({
  currentModal: SEND_MODAL.CLOSE,
  previousModal: SEND_MODAL.CLOSE,
  ...EMPTY_FORM,

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
  setIsCrossChain: isCrossChain => set({ isCrossChain }),
  setDestinationChainId: chainId => set({ destinationChainId: chainId }),
  setCrossChainQuote: quote => set({ crossChainQuote: quote }),
  setCrossChainSend: send => set({ crossChainSend: send }),
  clearForm: () => set({ ...EMPTY_FORM }),
  resetAll: () =>
    set({
      currentModal: SEND_MODAL.CLOSE,
      previousModal: SEND_MODAL.CLOSE,
      ...EMPTY_FORM,
    }),
}));

/**
 * Check if there is unsaved data in the send form.
 * Used to determine if a discard confirmation dialog should be shown.
 */
export const hasUnsavedSendData = (): boolean => {
  const state = useSendStore.getState();
  return !!(
    state.amount ||
    state.address ||
    state.selectedToken ||
    state.name ||
    state.destinationChainId
  );
};

/**
 * Where the Send modal goes once a recipient is picked (search row, typed
 * address, new contact, QR): the network step in the cross-chain flow, the
 * regular send form otherwise.
 */
export const recipientNextModal = () =>
  useSendStore.getState().isCrossChain ? SEND_MODAL.OPEN_CROSS_CHAIN_NETWORK : SEND_MODAL.OPEN_FORM;
