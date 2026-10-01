import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import mmkvStorage from '@/lib/mmvkStorage';

interface SpendModeHelpState {
  /** Accounts that have had the Spend Mode help opened automatically. */
  shownByUserId: Record<string, boolean>;
  markShown: (userId: string) => void;
}

const SPEND_MODE_HELP_STORAGE_KEY = 'spend-mode-help-storage';

/** Show the Spend Mode explanation once per account on this device. */
export const useSpendModeHelpStore = create<SpendModeHelpState>()(
  persist(
    set => ({
      shownByUserId: {},
      markShown: userId =>
        set(state => ({
          shownByUserId: { ...state.shownByUserId, [userId]: true },
        })),
    }),
    {
      name: SPEND_MODE_HELP_STORAGE_KEY,
      storage: createJSONStorage(() => mmkvStorage(SPEND_MODE_HELP_STORAGE_KEY)),
    },
  ),
);
