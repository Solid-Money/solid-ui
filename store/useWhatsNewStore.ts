import { create } from 'zustand';

import { WhatsNew } from '@/lib/types';

/** A link's ask to open one announcement on one of its pages. */
export interface WhatsNewRequest {
  id: string;
  /** 0-based page. Clamped to the announcement's length when it opens. */
  step: number;
}

interface WhatsNewState {
  whatsNew: WhatsNew | null;
  isVisible: boolean;
  isHomeReady: boolean;
  /**
   * The page the popup opens on. 0 everywhere except a link that named a page
   * (`?whatsNew=<id>&whatsNewStep=<n>`), so a push about the third feature in
   * an announcement shows the third page rather than making the user page to it.
   */
  initialStep: number;
  /** A link's pending ask, until `useWhatsNew` has the announcement to show. */
  request: WhatsNewRequest | null;
  setWhatsNew: (whatsNew: WhatsNew | null) => void;
  setIsVisible: (isVisible: boolean) => void;
  setHomeReady: (isHomeReady: boolean) => void;
  setInitialStep: (initialStep: number) => void;
  requestWhatsNew: (id: string, step: number) => void;
  clearRequest: () => void;
}

export const useWhatsNewStore = create<WhatsNewState>(set => ({
  whatsNew: null,
  isVisible: false,
  isHomeReady: false,
  initialStep: 0,
  request: null,
  setWhatsNew: whatsNew => set({ whatsNew }),
  setIsVisible: isVisible => set({ isVisible }),
  setHomeReady: isHomeReady => set({ isHomeReady }),
  setInitialStep: initialStep => set({ initialStep }),
  requestWhatsNew: (id, step) => set({ request: { id, step } }),
  clearRequest: () => set({ request: null }),
}));
