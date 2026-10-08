import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import mmkvStorage from '@/lib/mmvkStorage';

interface OnboardingState {
  hasSeenOnboarding: boolean;
  hasSeenNotificationOnboarding: boolean;
  lastNotificationPromptAt: number | null;
  setHasSeenOnboarding: (seen: boolean) => void;
  setHasSeenNotificationOnboarding: (seen: boolean) => void;
  recordNotificationPrompt: () => void;
}

const ONBOARDING_STORAGE_KEY = 'onboarding-storage';

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    set => ({
      hasSeenOnboarding: false,
      hasSeenNotificationOnboarding: false,
      // Older OTA installs have no timestamp, so they can be prompted on their
      // first Home visit without resetting their existing onboarding flags.
      lastNotificationPromptAt: null,
      setHasSeenOnboarding: (seen: boolean) => set({ hasSeenOnboarding: seen }),
      setHasSeenNotificationOnboarding: (seen: boolean) =>
        set({ hasSeenNotificationOnboarding: seen }),
      recordNotificationPrompt: () => set({ lastNotificationPromptAt: Date.now() }),
    }),
    {
      name: ONBOARDING_STORAGE_KEY,
      storage: createJSONStorage(() => mmkvStorage(ONBOARDING_STORAGE_KEY)),
    },
  ),
);
