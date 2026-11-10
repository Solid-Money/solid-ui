import { create } from 'zustand';

import { WhatsNew } from '@/lib/types';

interface WhatsNewState {
  whatsNew: WhatsNew | null;
  isVisible: boolean;
  isHomeReady: boolean;
  /**
   * Popups whose image (or video poster) failed to load this session. They are
   * not marked as seen, so they come back on the next launch, but they don't
   * retry every few seconds in the meantime.
   */
  failedIds: string[];
  setWhatsNew: (whatsNew: WhatsNew | null) => void;
  setIsVisible: (isVisible: boolean) => void;
  setHomeReady: (isHomeReady: boolean) => void;
  markFailed: (id: string) => void;
}

export const useWhatsNewStore = create<WhatsNewState>(set => ({
  whatsNew: null,
  isVisible: false,
  isHomeReady: false,
  failedIds: [],
  setWhatsNew: whatsNew => set({ whatsNew }),
  setIsVisible: isVisible => set({ isVisible }),
  setHomeReady: isHomeReady => set({ isHomeReady }),
  markFailed: id =>
    set(state => (state.failedIds.includes(id) ? state : { failedIds: [...state.failedIds, id] })),
}));
