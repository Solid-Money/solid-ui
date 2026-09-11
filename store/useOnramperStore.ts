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
  /**
   * Country to quote against, chosen by hand on qa/preview builds.
   *
   * Testing affordance only: Onramper serves very few countries, and rebuilding
   * with a different `EXPO_PUBLIC_ONRAMPER_COUNTRY` to try another one costs a
   * bundle each time. Null means "use the env override, or geo".
   */
  country: string | null;
  setFiatAmount: (fiatAmount: string) => void;
  setFiatCurrency: (fiatCurrency: string) => void;
  setAssetId: (assetId: string) => void;
  setCountry: (country: string) => void;
  reset: () => void;
}

export const useOnramperStore = create<OnramperState>(set => ({
  fiatAmount: '',
  fiatCurrency: null,
  assetId: null,
  country: null,
  setFiatAmount: fiatAmount => set({ fiatAmount }),
  // The asset list is per-currency, so a currency change invalidates the
  // selection — clearing it lets the amount screen fall back to the first
  // deliverable asset for the new currency instead of quoting a stale pair.
  setFiatCurrency: fiatCurrency => set({ fiatCurrency, assetId: null }),
  setAssetId: assetId => set({ assetId }),
  // Both selections are per-country, so switching clears them rather than
  // quoting a pair the new country may not offer.
  setCountry: country => set({ country: country.toUpperCase(), assetId: null }),
  // `country` deliberately survives a reset: it is a tester's setting for the
  // session, not part of the purchase being entered.
  reset: () => set({ fiatAmount: '', fiatCurrency: null, assetId: null }),
}));
