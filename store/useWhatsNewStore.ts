import { create } from 'zustand';

import { WhatsNew } from '@/lib/types';

interface WhatsNewState {
  whatsNew: WhatsNew | null;
  isVisible: boolean;
  isHomeReady: boolean;
  setWhatsNew: (whatsNew: WhatsNew | null) => void;
  setIsVisible: (isVisible: boolean) => void;
  setHomeReady: (isHomeReady: boolean) => void;
}

export const useWhatsNewStore = create<WhatsNewState>(set => ({
  whatsNew: null,
  isVisible: false,
  isHomeReady: false,
  setWhatsNew: whatsNew => set({ whatsNew }),
  setIsVisible: isVisible => set({ isVisible }),
  setHomeReady: isHomeReady => set({ isHomeReady }),
}));
