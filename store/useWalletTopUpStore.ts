import { create } from 'zustand';

import type {
  WalletTopUpCurrency,
  WalletTopUpMethod,
  WalletTopUpMoney,
  WalletTopUpQuoteResponse,
} from '@/lib/types/wallet-topup';

/**
 * How the status step was reached: the checkout reported the top-up executed,
 * it could not tell (a failed execute that may still have charged), or the
 * desktop QR handed the payment to a phone.
 */
export type WalletTopUpStatusEntry = 'executed' | 'reconcile' | 'handoff';

/** Which row opened the flow — for analytics, and nothing else. */
export type WalletTopUpSource = 'deposit' | 'card_fund';

/**
 * Ephemeral state for the Apple Pay / Google Pay top-up, shared across its steps
 * (amount → review → status), which the deposit modal renders without props.
 *
 * Deliberately not persisted. The quote carries Wirex's checkout token, a
 * credential that must never reach storage, and it is dropped as soon as the
 * checkout is done with it (`endCheckout`) and on every reset.
 */
interface WalletTopUpState {
  /** Set by the entry row, from what this device can pay with. */
  method: WalletTopUpMethod;
  source: WalletTopUpSource;
  /** Null until the amount step settles it from the backend's default. */
  currency: WalletTopUpCurrency | null;
  /** What the user typed, e.g. "100" or "25.50". */
  amount: string;
  /** The live quote and its checkout token. Memory only. */
  quote: WalletTopUpQuoteResponse | null;
  /** The top-up the status step reads. Survives `endCheckout`. */
  estimationId: string | null;
  /** What the user gets, for the status step until its first read lands. */
  receipt: WalletTopUpMoney | null;
  statusEntry: WalletTopUpStatusEntry;
  start: (method: WalletTopUpMethod, source: WalletTopUpSource) => void;
  setCurrency: (currency: WalletTopUpCurrency) => void;
  setAmount: (amount: string) => void;
  setQuote: (quote: WalletTopUpQuoteResponse) => void;
  /** Drops the quote (and its token) and keeps the top-up to read. */
  endCheckout: (entry: WalletTopUpStatusEntry) => void;
  /** Leaving the review step: that quote and its token are done with. */
  clearQuote: () => void;
  /** Back to the amount step: the same amount, a quote yet to fetch. */
  restart: () => void;
  reset: () => void;
}

const INITIAL = {
  method: 'apple_pay' as WalletTopUpMethod,
  source: 'deposit' as WalletTopUpSource,
  currency: null,
  amount: '',
  quote: null,
  estimationId: null,
  receipt: null,
  statusEntry: 'executed' as WalletTopUpStatusEntry,
};

export const useWalletTopUpStore = create<WalletTopUpState>(set => ({
  ...INITIAL,
  // A new top-up starts from nothing but the wallet it pays with.
  start: (method, source) => set({ ...INITIAL, method, source }),
  setCurrency: currency => set({ currency }),
  setAmount: amount => set({ amount }),
  setQuote: quote =>
    set({
      quote,
      estimationId: quote.estimationId,
      receipt: quote.quote.destinationAmount,
    }),
  endCheckout: entry => set({ quote: null, statusEntry: entry }),
  clearQuote: () => set({ quote: null }),
  restart: () => set({ quote: null, estimationId: null, receipt: null, statusEntry: 'executed' }),
  reset: () => set(INITIAL),
}));
