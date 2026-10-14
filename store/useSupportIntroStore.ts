import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import mmkvStorage from '@/lib/mmvkStorage';

interface SupportIntroState {
  /** Accounts that have seen the "Meet Solid AI" sheet on this device. */
  seenByUserId: Record<string, boolean>;
  markSeen: (userId: string) => void;
}

const SUPPORT_INTRO_STORAGE_KEY = 'support-intro-storage';

/** The first time someone opens the support chat they get a short intro to Solid AI, once. */
export const useSupportIntroStore = create<SupportIntroState>()(
  persist(
    set => ({
      seenByUserId: {},
      markSeen: userId =>
        set(state => ({ seenByUserId: { ...state.seenByUserId, [userId]: true } })),
    }),
    {
      name: SUPPORT_INTRO_STORAGE_KEY,
      storage: createJSONStorage(() => mmkvStorage(SUPPORT_INTRO_STORAGE_KEY)),
    },
  ),
);
