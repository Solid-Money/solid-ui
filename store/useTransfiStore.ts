import { create } from 'zustand';

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
  setAmount: (usdcAmount: string) => void;
  setPaymentCode: (paymentCode: string) => void;
  setFiatCurrency: (fiatCurrency: string) => void;
  setOrder: (order: { orderId: string; payUrl?: string | null }) => void;
  reset: () => void;
}

export const useTransfiStore = create<TransfiState>(set => ({
  usdcAmount: '',
  paymentCode: null,
  fiatCurrency: null,
  orderId: null,
  payUrl: null,
  setAmount: usdcAmount => set({ usdcAmount }),
  setPaymentCode: paymentCode => set({ paymentCode }),
  setFiatCurrency: fiatCurrency => set({ fiatCurrency }),
  setOrder: ({ orderId, payUrl }) => set({ orderId, payUrl: payUrl ?? null }),
  reset: () =>
    set({
      usdcAmount: '',
      paymentCode: null,
      fiatCurrency: null,
      orderId: null,
      payUrl: null,
    }),
}));
