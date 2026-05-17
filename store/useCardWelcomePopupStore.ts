import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import mmkvStorage from '@/lib/mmvkStorage';

interface CardWelcomePopupState {
  shouldShowWelcomePopup: boolean;
  setShouldShowWelcomePopup: (value: boolean) => void;
}

const CARD_WELCOME_POPUP_STORAGE_KEY = 'card-welcome-popup-storage';

export const useCardWelcomePopupStore = create<CardWelcomePopupState>()(
  persist(
    set => ({
      shouldShowWelcomePopup: false,
      setShouldShowWelcomePopup: (value: boolean) => set({ shouldShowWelcomePopup: value }),
    }),
    {
      name: CARD_WELCOME_POPUP_STORAGE_KEY,
      storage: createJSONStorage(() => mmkvStorage(CARD_WELCOME_POPUP_STORAGE_KEY)),
    },
  ),
);
