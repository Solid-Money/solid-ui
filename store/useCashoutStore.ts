import { create } from 'zustand';

import { TransfiError } from '@/lib/transfiErrors';
import { DepositModal, TransfiCashoutDepositInstructions } from '@/lib/types';

/**
 * A move from Fuse topping up the Base balance for this cash-out, once it's on
 * its way. `shortfallLD` is what the cash-out needed from Fuse (base units).
 */
export interface CashoutBridge {
  sendId: string;
  shortfallLD: string;
  delivered: boolean;
}

/**
 * Cash-out (TransFi offramp) state for the Send drawer. Not persisted: an
 * opened order's deposit instructions belong to this one attempt, and reusing
 * them after a restart could send USDC to an order that has since expired.
 */
interface CashoutState {
  currency?: string;
  paymentCode?: string;
  /** Values for the payout method's fields, keyed by field key. */
  paymentDetails: Record<string, string>;
  /** What the server refused in those details, keyed by field key. */
  fieldErrors: Record<string, string>;
  usdcAmount: string;
  /** The opened order — where and how much to send. */
  order: TransfiCashoutDepositInstructions | null;
  /** Set once the USDC transfer is on-chain. */
  depositTxHash?: string;
  bridge: CashoutBridge | null;
  /** Which embedded TransFi KYC screen OPEN_CASHOUT_KYC shows. */
  kycModal: DepositModal | null;
  error: TransfiError | null;
  setCurrency: (currency: string) => void;
  setPaymentCode: (paymentCode: string) => void;
  setPaymentDetails: (details: Record<string, string>) => void;
  setFieldErrors: (errors: Record<string, string>) => void;
  setUsdcAmount: (amount: string) => void;
  setOrder: (order: TransfiCashoutDepositInstructions | null) => void;
  setDepositTxHash: (hash: string) => void;
  setBridge: (bridge: CashoutBridge | null) => void;
  /** The move landed; the cash-out is now `usdcAmount` (less if it landed short). */
  settleBridge: (usdcAmount: string) => void;
  setKycModal: (modal: DepositModal | null) => void;
  setError: (error: TransfiError | null) => void;
  reset: () => void;
}

const INITIAL = {
  currency: undefined,
  paymentCode: undefined,
  paymentDetails: {},
  fieldErrors: {},
  usdcAmount: '',
  order: null,
  depositTxHash: undefined,
  bridge: null,
  kycModal: null,
  error: null,
};

export const useCashoutStore = create<CashoutState>()(set => ({
  ...INITIAL,
  // A new currency means a new set of methods and fields: what was typed for
  // the old one no longer applies. Any change to what is being cashed out also
  // drops an opened order — its deposit instructions describe the old one — and
  // forgets a finished move from Fuse, which was sized for the old one.
  setCurrency: currency =>
    set({
      currency,
      paymentCode: undefined,
      paymentDetails: {},
      fieldErrors: {},
      order: null,
      bridge: null,
    }),
  setPaymentCode: paymentCode =>
    set({ paymentCode, paymentDetails: {}, fieldErrors: {}, order: null, bridge: null }),
  setPaymentDetails: paymentDetails => set({ paymentDetails, order: null, bridge: null }),
  setFieldErrors: fieldErrors => set({ fieldErrors }),
  setUsdcAmount: usdcAmount => set({ usdcAmount, order: null, bridge: null }),
  setOrder: order => set({ order }),
  setDepositTxHash: depositTxHash => set({ depositTxHash }),
  setBridge: bridge => set({ bridge }),
  settleBridge: usdcAmount =>
    set(state => ({
      usdcAmount,
      order: null,
      bridge: state.bridge && { ...state.bridge, delivered: true },
    })),
  setKycModal: kycModal => set({ kycModal }),
  setError: error => set({ error }),
  reset: () => set(INITIAL),
}));

/** Whether closing the drawer would throw away something the user typed. */
export const hasUnsavedCashoutData = (): boolean => {
  const state = useCashoutStore.getState();
  // Once the transfer is out there is nothing left to lose by closing.
  if (state.depositTxHash) return false;
  return Boolean(state.usdcAmount || Object.keys(state.paymentDetails).length);
};
