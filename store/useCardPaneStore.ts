import { create } from 'zustand';

import { CardHeroRect } from './useCardHeroStore';

interface CardPaneState {
  /**
   * Whether the card-details pane is showing. The pane is part of the wallet
   * screen rather than a route of its own, so opening it is a state change on a
   * tree that's already mounted — nothing has to load while the card animates,
   * which is what keeps the transition smooth.
   */
  isOpen: boolean;
  /**
   * Window rect of the wallet screen's card, captured when the pane was opened, so
   * closing can fly the card back to where it came from. Null when the pane was
   * opened without a tap (a deep link into /card/details).
   */
  originRect: CardHeroRect | null;
  open: (originRect?: CardHeroRect | null) => void;
  close: () => void;
}

export const useCardPaneStore = create<CardPaneState>(set => ({
  isOpen: false,
  originRect: null,
  open: (originRect = null) => set({ isOpen: true, originRect }),
  close: () => set({ isOpen: false }),
}));
