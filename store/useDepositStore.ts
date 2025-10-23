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
import { DepositModal, SourceDepositInstructions, TransactionStatusModal } from '@/lib/types';

interface BankTransferData {
  fiatAmount?: string;
  cryptoAmount?: string;
  fiat?: BridgeTransferFiatCurrency;
  crypto?: BridgeTransferCryptoCurrency;
  method?: string;
  instructions?: SourceDepositInstructions;

  // Used to determine if the bank transfer data is coming from the activity feed
  // If so, the bank transfer preview will not show the back button
  fromActivity?: boolean;
}

interface KycData {
  kycMode?: string;
  endorsement?: string;
  redirectUri?: string;
  kycLink?: string;
  kycLinkId?: string;
}

interface DirectDepositSession {
  sessionId?: string;
  walletAddress?: string;
  chainId?: number;
  status?: 'pending' | 'detected' | 'processing' | 'completed' | 'failed' | 'expired';
  expiresAt?: number;
  minDeposit?: string;
  maxDeposit?: string;
  fee?: string;
  detectedAmount?: string;
  transactionHash?: string;
}

interface DepositState {
  currentModal: DepositModal;
  previousModal: DepositModal;
  transaction: TransactionStatusModal;
  srcChainId: number;
  bankTransfer: BankTransferData;
  kyc: KycData;
  directDepositSession: DirectDepositSession;
  setModal: (modal: DepositModal) => void;
  setTransaction: (transaction: TransactionStatusModal) => void;
  setBankTransferData: (data: Partial<BankTransferData>) => void;
  clearBankTransferData: () => void;
  setKycData: (data: Partial<KycData>) => void;
  clearKycData: () => void;
  setSrcChainId: (srcChainId: number) => void;
  setDirectDepositSession: (data: Partial<DirectDepositSession>) => void;
  clearDirectDepositSession: () => void;
}

export const useDepositStore = create<DepositState>()(
  persist(
    (set, get) => ({
      currentModal: DEPOSIT_MODAL.CLOSE,
      previousModal: DEPOSIT_MODAL.CLOSE,
      transaction: {},
      srcChainId: mainnet.id,
      bankTransfer: {},
      kyc: {},
      directDepositSession: {},

      setModal: modal =>
        set({
          previousModal: get().currentModal,
          currentModal: modal,
        }),
      setTransaction: transaction => set({ transaction }),
      setBankTransferData: data => set({ bankTransfer: { ...get().bankTransfer, ...data } }),
      clearBankTransferData: () => set({ bankTransfer: {} }),
      setKycData: data => set({ kyc: { ...get().kyc, ...data } }),
      clearKycData: () => set({ kyc: {} }),
      setSrcChainId: srcChainId => set({ srcChainId }),
      setDirectDepositSession: data =>
        set({ directDepositSession: { ...get().directDepositSession, ...data } }),
      clearDirectDepositSession: () => set({ directDepositSession: {} }),
    }),
    {
      name: USER.depositStorageKey,
      storage: createJSONStorage(() => mmkvStorage(USER.depositStorageKey)),
      // Do not persist modal open state
      partialize: state => ({
        transaction: state.transaction,
        srcChainId: state.srcChainId,
        bankTransfer: state.bankTransfer,
        kyc: state.kyc,
        directDepositSession: state.directDepositSession,
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
