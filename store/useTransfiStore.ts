import { create } from 'zustand';

import { TransfiError } from '@/lib/transfiErrors';
import { DepositModal } from '@/lib/types';

/**
 * Ephemeral state for the TransFi buy-crypto flow, shared across the Add-funds
 * modal steps (amount → payment → status). Not persisted — it only needs to
 * survive step transitions within a single flow.
 */
interface TransfiState {
  usdcAmount: string;
  paymentCode: string | null;
  fiatCurrency: string | null;
  orderId: string | null;
  payUrl: string | null;
  /**
   * The failure the error step renders. Kept here rather than in the mutation
   * so it survives the step transition — react-query drops the mutation error
   * as soon as the amount screen unmounts.
   */
  error: TransfiError | null;
  /**
   * The step the failure came from, so "Try again" returns there. The amount
   * screen and the two KYC screens can all raise the same transient error, and
   * retrying on the wrong one just fails differently.
   */
  errorOrigin: DepositModal | null;
  setAmount: (usdcAmount: string) => void;
  setPaymentCode: (paymentCode: string) => void;
  setFiatCurrency: (fiatCurrency: string) => void;
  setOrder: (order: { orderId: string; payUrl?: string | null }) => void;
  setError: (error: TransfiError | null, origin?: DepositModal) => void;
  reset: () => void;
}

export const useTransfiStore = create<TransfiState>(set => ({
  usdcAmount: '',
  paymentCode: null,
  fiatCurrency: null,
  orderId: null,
  payUrl: null,
  error: null,
  errorOrigin: null,
  setAmount: usdcAmount => set({ usdcAmount }),
  setPaymentCode: paymentCode => set({ paymentCode }),
  setFiatCurrency: fiatCurrency => set({ fiatCurrency }),
  setOrder: ({ orderId, payUrl }) => set({ orderId, payUrl: payUrl ?? null }),
  setError: (error, origin) => set({ error, errorOrigin: origin ?? null }),
  reset: () =>
    set({
      usdcAmount: '',
      paymentCode: null,
      fiatCurrency: null,
      orderId: null,
      payUrl: null,
      error: null,
      errorOrigin: null,
    }),
}));
