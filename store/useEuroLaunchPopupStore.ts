import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import mmkvStorage from '@/lib/mmvkStorage';

interface EuroLaunchPopupState {
  /** User ids the euro launch popup has already opened for on this device. */
  seen: Record<string, true>;
  markSeen: (userId: string) => void;
}

const EURO_LAUNCH_POPUP_STORAGE_KEY = 'euro-launch-popup-storage';

/**
 * Which users this device has already shown the euro launch popup to.
 *
 * The popup is an announcement, so it opens by itself once per user and then stays away: "Not
 * now" is an answer, and the Main currency page is always there for anyone who changes their
 * mind. Keyed by user so a second account on the same device still gets its own.
 *
 * Not authoritative — losing the store costs nothing worse than seeing the announcement again.
 */
export const useEuroLaunchPopupStore = create<EuroLaunchPopupState>()(
  persist(
    set => ({
      seen: {},
      markSeen: (userId: string) => set(state => ({ seen: { ...state.seen, [userId]: true } })),
    }),
    {
      name: EURO_LAUNCH_POPUP_STORAGE_KEY,
      storage: createJSONStorage(() => mmkvStorage(EURO_LAUNCH_POPUP_STORAGE_KEY)),
    },
  ),
);
