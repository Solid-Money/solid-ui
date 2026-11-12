import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import mmkvStorage from '@/lib/mmvkStorage';

const RAIN_SUNSET_STORAGE_KEY = 'rain-sunset-storage';

interface RainSunsetState {
  /**
   * Home banner keys (`state@closesAt`) closed on this device. The banner can
   * only be closed when it asks nothing of the user — no balance left, or the
   * new-card offer — so a new date or a new balance brings it back.
   */
  dismissedBanners: string[];
  dismissBanner: (key: string) => void;
  /** The "What happens next" sheet (Figma "4 · What happens next"). */
  isSheetOpen: boolean;
  setSheetOpen: (open: boolean) => void;
}

/**
 * What this device did with the card-closing notice. Not authoritative: losing
 * it costs nothing worse than seeing the banner again.
 */
export const useRainSunsetStore = create<RainSunsetState>()(
  persist(
    set => ({
      dismissedBanners: [],
      dismissBanner: key =>
        set(state => ({
          dismissedBanners: [...state.dismissedBanners.filter(k => k !== key), key].slice(-20),
        })),
      isSheetOpen: false,
      setSheetOpen: open => set({ isSheetOpen: open }),
    }),
    {
      name: RAIN_SUNSET_STORAGE_KEY,
      storage: createJSONStorage(() => mmkvStorage(RAIN_SUNSET_STORAGE_KEY)),
      partialize: ({ dismissedBanners }) => ({ dismissedBanners }),
    },
  ),
);
