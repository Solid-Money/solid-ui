import { create } from 'zustand';

export type CardHeroRect = { x: number; y: number; width: number; height: number };

interface CardHeroState {
  /** The card is in the air. */
  active: boolean;
  /** Window-space rect the card is flying from. */
  fromRect: CardHeroRect | null;
  /** Window-space rect the card is flying to. */
  toRect: CardHeroRect | null;
  /** Last 4 digits rendered on the flying clone's glyph badge (may be empty). */
  last4: string;
  /**
   * Fly the card between two rects. Both are known up front — the live one is
   * measured, the other comes from `getCardHeroDestination` — so the flight starts on
   * the frame of the tap with nothing to wait for. Used in both directions: wallet
   * card → pane when opening, and back again when dismissing.
   */
  start: (fromRect: CardHeroRect, toRect: CardHeroRect, last4: string) => void;
  /** Flight finished (or aborted) — clear everything. */
  end: () => void;
}

export const useCardHeroStore = create<CardHeroState>(set => ({
  active: false,
  fromRect: null,
  toRect: null,
  last4: '',
  start: (fromRect, toRect, last4) => set({ active: true, fromRect, toRect, last4 }),
  end: () => set({ active: false, fromRect: null, toRect: null, last4: '' }),
}));
