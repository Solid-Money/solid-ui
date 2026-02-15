import { create } from 'zustand';

import { WhatsNew } from '@/lib/types';

interface WhatsNewState {
  whatsNew: WhatsNew | null;
  isVisible: boolean;
  setWhatsNew: (whatsNew: WhatsNew | null) => void;
  setIsVisible: (isVisible: boolean) => void;
}

export const useWhatsNewStore = create<WhatsNewState>(set => ({
  whatsNew: null,
  isVisible: false,
  setWhatsNew: whatsNew => set({ whatsNew }),
  setIsVisible: isVisible => set({ isVisible }),
}));
