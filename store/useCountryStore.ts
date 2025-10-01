import mmkvStorage from '@/lib/mmvkStorage';
import { CountryInfo } from '@/lib/types';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

interface CountryState {
  countryInfo: CountryInfo | null;
  lastFetchTime: number | null;
  
  setCountryInfo: (info: CountryInfo) => void;
  clearCountryInfo: () => void;
}

const COUNTRY_STORAGE_KEY = 'country-info-storage';
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes in milliseconds

export const useCountryStore = create<CountryState>()(
  persist(
    (set) => ({
      countryInfo: null,
      lastFetchTime: null,

      setCountryInfo: (info: CountryInfo) => {
        set({ 
          countryInfo: info,
          lastFetchTime: Date.now()
        });
      },

      clearCountryInfo: () => {
        set({ 
          countryInfo: null,
          lastFetchTime: null
        });
      },
    }),
    {
      name: COUNTRY_STORAGE_KEY,
      storage: createJSONStorage(() => mmkvStorage(COUNTRY_STORAGE_KEY)),
    },
  ),
);

export const shouldRefetchCountry = (lastFetchTime: number | null): boolean => {
  if (!lastFetchTime) return true;
  
  const now = Date.now();
  return now - lastFetchTime > CACHE_DURATION;
};
