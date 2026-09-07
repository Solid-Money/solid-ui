import { create } from 'zustand';

/**
 * Ephemeral state for the Onramper buy-crypto flow, shared across the funding
 * modal steps (amount → currency → asset). Not persisted — it only needs to
 * survive step transitions within a single flow.
 *
 * The amount is held as the string the user typed rather than a number so the
 * input stays authoritative: parsing on every keystroke would rewrite "1." to
 * "1" mid-entry.
 */
interface OnramperState {
  /** Amount in `fiatCurrency` — Onramper prices buys from the fiat side. */
  fiatAmount: string;
  /** Onramper fiat id, e.g. 'usd'. Null until config resolves. */
  fiatCurrency: string | null;
  /** Onramper asset id, e.g. 'usdc_base'. Null until the assets load. */
  assetId: string | null;
  setFiatAmount: (fiatAmount: string) => void;
  setFiatCurrency: (fiatCurrency: string) => void;
  setAssetId: (assetId: string) => void;
  reset: () => void;
}

export const useOnramperStore = create<OnramperState>(set => ({
  fiatAmount: '',
  fiatCurrency: null,
  assetId: null,
  setFiatAmount: fiatAmount => set({ fiatAmount }),
  // The asset list is per-currency, so a currency change invalidates the
  // selection — clearing it lets the amount screen fall back to the first
  // deliverable asset for the new currency instead of quoting a stale pair.
  setFiatCurrency: fiatCurrency => set({ fiatCurrency, assetId: null }),
  setAssetId: assetId => set({ assetId }),
  reset: () => set({ fiatAmount: '', fiatCurrency: null, assetId: null }),
}));
