import mmkvStorage from '@/lib/mmvkStorage';
import { CountryInfo } from '@/lib/types';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

interface IpCountryCache {
  info: CountryInfo;
  fetchTime: number;
}

interface IpCache {
  ip: string;
  fetchTime: number;
}

interface CountryState {
  // Current country info (can be manually selected or from IP)
  countryInfo: CountryInfo | null;

  // Cache for IP-detected countries
  ipCountryCache: Record<string, IpCountryCache>;

  // Cache for IP address
  cachedIp: IpCache | null;

  // Store methods
  setCountryInfo: (info: CountryInfo) => void;
  setIpDetectedCountry: (ip: string, info: CountryInfo) => void;
  getIpDetectedCountry: (ip: string) => CountryInfo | null;
  setCachedIp: (ip: string) => void;
  getCachedIp: () => string | null;
  clearCountryInfo: () => void;
}

const COUNTRY_STORAGE_KEY = 'country-info-storage';
const oneHour = 60 * 60 * 1000;
const CACHE_DURATION = 24 * oneHour;

export const useCountryStore = create<CountryState>()(
  persist(
    (set, get) => ({
      countryInfo: null,
      ipCountryCache: {},
      cachedIp: null,

      setCountryInfo: (info: CountryInfo) => {
        set({ countryInfo: info });
      },

      setIpDetectedCountry: (ip: string, info: CountryInfo) => {
        set(state => ({
          countryInfo: info,
          ipCountryCache: {
            ...state.ipCountryCache,
            [ip]: {
              info,
              fetchTime: Date.now(),
            },
          },
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

      setCachedIp: (ip: string) => {
        set({
          cachedIp: {
            ip,
            fetchTime: Date.now(),
          },
        });
      },

      getCachedIp: () => {
        const state = get();
        const cached = state.cachedIp;

        if (!cached) return null;

        // Check if cache is still valid
        const now = Date.now();

        if (now - cached.fetchTime > CACHE_DURATION) return null;

        return cached.ip;
      },

      clearCountryInfo: () => {
        set({
          countryInfo: null,
          ipCountryCache: {},
          cachedIp: null,
        });
      },
    }),
    {
      name: COUNTRY_STORAGE_KEY,
      storage: createJSONStorage(() => mmkvStorage(COUNTRY_STORAGE_KEY)),
    },
  ),
);
