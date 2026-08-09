import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import mmkvStorage from '@/lib/mmvkStorage';
import { CountryInfo } from '@/lib/types';

interface CountryState {
  /**
   * The user's country — either detected from their IP or picked by hand on the
   * country selection screen. `null` means "not resolved yet".
   */
  countryInfo: CountryInfo | null;
  /** When an IP-detected `countryInfo` was resolved. Manual picks don't expire. */
  detectedAt: number | null;

  setCountryInfo: (info: CountryInfo) => void;
  /** True when `countryInfo` came from an IP lookup old enough to redo. */
  isStale: () => boolean;
  clearCountryInfo: () => void;
}

const COUNTRY_STORAGE_KEY = 'country-info-storage';
/** How long an IP-detected country is trusted before it's looked up again. */
const IP_COUNTRY_TTL_MS = 24 * 60 * 60 * 1000;

export const useCountryStore = create<CountryState>()(
  persist(
    (set, get) => ({
      countryInfo: null,
      detectedAt: null,

      setCountryInfo: (info: CountryInfo) => {
        set({
          countryInfo: { ...info, source: info.source ?? 'manual' },
          detectedAt: Date.now(),
        });
      },

      isStale: () => {
        const { countryInfo, detectedAt } = get();

        if (!countryInfo) return true;
        // A country the user picked themselves stands until they change it.
        if (countryInfo.source !== 'ip') return false;

        return !detectedAt || Date.now() - detectedAt > IP_COUNTRY_TTL_MS;
      },

      clearCountryInfo: () => {
        set({ countryInfo: null, detectedAt: null });
      },
    }),
    {
      name: COUNTRY_STORAGE_KEY,
      version: 2,
      storage: createJSONStorage(() => mmkvStorage(COUNTRY_STORAGE_KEY)),
      // v2 drops the per-IP cache map, the cached IP and the
      // `countryDetectionFailed` latch that v1 kept — detection now lives in
      // `lib/geo.ts`, which retries across several providers instead of
      // remembering a failure. Any persisted v1 state is discarded so clients
      // re-detect against the current allowed-countries config rather than
      // staying stuck on a stale "not available".
      migrate: () => ({ countryInfo: null, detectedAt: null }) as CountryState,
    },
  ),
);
