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

  /**
   * Tracks whether the user entered KYC frame via the info form (new customer flow).
   * Used by back navigation to determine correct destination:
   * - true: go back to info form
   * - false/undefined: go back to payment method (existing customer skipped info form)
   */
  enteredViaInfoForm?: boolean;
}

interface DirectDepositSession {
  sessionId?: string;
  walletAddress?: string;
  chainId?: number;
  selectedToken?: 'USDC' | 'USDT';
  status?: 'pending' | 'detected' | 'processing' | 'completed' | 'failed' | 'expired';
  expiresAt?: number;
  minDeposit?: string;
  maxDeposit?: string;
  fee?: string;
  detectedAmount?: string;
  transactionHash?: string;
  clientTxId?: string;
  // If opened from the Activity screen, we hide back navigation in the UI
  fromActivity?: boolean;
}

interface DepositState {
  currentModal: DepositModal;
  previousModal: DepositModal;
  transaction: TransactionStatusModal;
  srcChainId: number;
  outputToken: string;
  bankTransfer: BankTransferData;
  kyc: KycData;
  directDepositSession: DirectDepositSession;
  sessionStartTime?: number;
  setModal: (modal: DepositModal) => void;
  setTransaction: (transaction: TransactionStatusModal) => void;
  setBankTransferData: (data: Partial<BankTransferData>) => void;
  clearBankTransferData: () => void;
  setKycData: (data: Partial<KycData>) => void;
  clearKycData: () => void;
  setSrcChainId: (srcChainId: number) => void;
  setOutputToken: (token: string) => void;
  setDirectDepositSession: (data: Partial<DirectDepositSession>) => void;
  clearDirectDepositSession: () => void;
  setSessionStartTime: (time: number) => void;
  clearSessionStartTime: () => void;
}

export const useDepositStore = create<DepositState>()(
  persist(
    (set, get) => ({
      currentModal: DEPOSIT_MODAL.CLOSE,
      previousModal: DEPOSIT_MODAL.CLOSE,
      transaction: {},
      srcChainId: mainnet.id,
      outputToken: 'soUSD',
      bankTransfer: {},
      kyc: {},
      directDepositSession: {},
      sessionStartTime: undefined,

      setModal: modal => {
        set({
          previousModal: get().currentModal,
          currentModal: modal,
        });
      },
      setTransaction: transaction => set({ transaction }),
      setBankTransferData: data => set({ bankTransfer: { ...get().bankTransfer, ...data } }),
      clearBankTransferData: () => set({ bankTransfer: {} }),
      setKycData: data => set({ kyc: { ...get().kyc, ...data } }),
      clearKycData: () => set({ kyc: {} }),
      setSrcChainId: srcChainId => set({ srcChainId }),
      setOutputToken: outputToken => set({ outputToken }),
      setDirectDepositSession: data =>
        set({ directDepositSession: { ...get().directDepositSession, ...data } }),
      clearDirectDepositSession: () => set({ directDepositSession: {} }),
      setSessionStartTime: time => set({ sessionStartTime: time }),
      clearSessionStartTime: () => set({ sessionStartTime: undefined }),
    }),
    {
      name: USER.depositStorageKey,
      storage: createJSONStorage(() => mmkvStorage(USER.depositStorageKey)),
      // Do not persist modal open state
      partialize: state => ({
        transaction: state.transaction,
        srcChainId: state.srcChainId,
        outputToken: state.outputToken,
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
