import mmkvStorage from '@/lib/mmvkStorage';
import { CountryInfo } from '@/lib/types';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

interface IpCountryCache {
  info: CountryInfo;
  fetchTime: number;
}

interface CountryState {
  // Current country info (can be manually selected or from IP)
  countryInfo: CountryInfo | null;
  
  // Cache for IP-detected countries
  ipCountryCache: Record<string, IpCountryCache>;
  
  // Store methods
  setCountryInfo: (info: CountryInfo) => void;
  setIpDetectedCountry: (ip: string, info: CountryInfo) => void;
  getIpDetectedCountry: (ip: string) => CountryInfo | null;
  clearCountryInfo: () => void;
}

const COUNTRY_STORAGE_KEY = 'country-info-storage';
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes in milliseconds

export const useCountryStore = create<CountryState>()(
  persist(
    (set, get) => ({
      countryInfo: null,
      ipCountryCache: {},

      setCountryInfo: (info: CountryInfo) => {
        set({ countryInfo: info });
      },

      setIpDetectedCountry: (ip: string, info: CountryInfo) => {
        set((state) => ({
          countryInfo: info,
          ipCountryCache: {
            ...state.ipCountryCache,
            [ip]: {
              info,
              fetchTime: Date.now()
            }
          }
        }));
      },

      getIpDetectedCountry: (ip: string) => {
        const state = get();
        const cachedEntry = state.ipCountryCache[ip];
        
        if (!cachedEntry) return null;
        
        // Check if cache is still valid
        const now = Date.now();
        if (now - cachedEntry.fetchTime > CACHE_DURATION) {
          return null;
        }
        
        return cachedEntry.info;
      },

      clearCountryInfo: () => {
        set({ 
          countryInfo: null,
          ipCountryCache: {}
        });
      },
    }),
    {
      name: COUNTRY_STORAGE_KEY,
      storage: createJSONStorage(() => mmkvStorage(COUNTRY_STORAGE_KEY)),
    },
  ),
);
