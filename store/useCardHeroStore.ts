import { create } from 'zustand';

export type CardHeroRect = { x: number; y: number; width: number; height: number };

interface CardHeroState {
  /**
   * Window-space rect of the home wallet card at the moment it was tapped.
   * The new card-details screen animates its card from here to its resting
   * position (a lightweight "view transition"), then clears it. Transient — not
   * persisted.
   */
  fromRect: CardHeroRect | null;
  setFromRect: (rect: CardHeroRect) => void;
  clear: () => void;
}

export const useCardHeroStore = create<CardHeroState>(set => ({
  fromRect: null,
  setFromRect: rect => set({ fromRect: rect }),
  clear: () => set({ fromRect: null }),
}));
