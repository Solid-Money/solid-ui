import { create } from 'zustand';

export type CardHeroRect = { x: number; y: number; width: number; height: number };

interface CardHeroState {
  /** A card hero transition is currently in progress. */
  active: boolean;
  /** Window-space rect of the home wallet card at the moment it was tapped. */
  fromRect: CardHeroRect | null;
  /** Window-space resting rect of the card on the card-details screen. */
  toRect: CardHeroRect | null;
  /** Last 4 digits rendered on the flying clone's glyph badge (may be empty). */
  last4: string;
  /**
   * Begin a transition from the home wallet card. Called right before navigating
   * to /card/details; the root <CardHeroOverlay/> then flies a card snapshot from
   * `fromRect` to the details card's measured `toRect`.
   */
  start: (fromRect: CardHeroRect, last4: string) => void;
  /** The details screen reports its resting card rect once laid out. */
  setToRect: (toRect: CardHeroRect) => void;
  /** Transition finished (or aborted) — clear everything. */
  end: () => void;
}

export const useCardHeroStore = create<CardHeroState>(set => ({
  active: false,
  fromRect: null,
  toRect: null,
  last4: '',
  start: (fromRect, last4) => set({ active: true, fromRect, toRect: null, last4 }),
  setToRect: toRect => set({ toRect }),
  end: () => set({ active: false, fromRect: null, toRect: null, last4: '' }),
}));
