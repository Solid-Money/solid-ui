import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import mmkvStorage from '@/lib/mmvkStorage';

interface OnboardingState {
  hasSeenOnboarding: boolean;
  setHasSeenOnboarding: (seen: boolean) => void;
}

const ONBOARDING_STORAGE_KEY = 'onboarding-storage';

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    set => ({
      hasSeenOnboarding: false,
      setHasSeenOnboarding: (seen: boolean) => set({ hasSeenOnboarding: seen }),
    }),
    {
      name: ONBOARDING_STORAGE_KEY,
      storage: createJSONStorage(() => mmkvStorage(ONBOARDING_STORAGE_KEY)),
    },
  ),
);
