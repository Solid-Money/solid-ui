import { create } from 'zustand';

import { DigitalWalletType } from '@/constants/digital-wallet';

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
  /**
   * Which "Add to Wallet" tab the pane should open its guide on, or null to
   * leave the guide closed. Set by a link carrying `?wallet=apple|google` (see
   * `cardInfoWalletGuidePath`) so the home "Add to Apple Pay" banner can be a
   * plain redirect and still land the user on the instructions.
   */
  walletGuide: DigitalWalletType | null;
  open: (originRect?: CardHeroRect | null) => void;
  /** Open the pane with the wallet guide already up on `wallet`'s tab. */
  openWalletGuide: (wallet: DigitalWalletType) => void;
  /** Close the guide, leaving the pane itself open. */
  dismissWalletGuide: () => void;
  close: () => void;
}

export const useCardPaneStore = create<CardPaneState>(set => ({
  isOpen: false,
  originRect: null,
  walletGuide: null,
  open: (originRect = null) => set({ isOpen: true, originRect }),
  openWalletGuide: (wallet: DigitalWalletType) =>
    // No origin rect: the user arrived by link, so there is no card on screen to
    // fly from — or back to when they close the pane.
    set({ isOpen: true, originRect: null, walletGuide: wallet }),
  dismissWalletGuide: () => set({ walletGuide: null }),
  // Clear the guide too: it was a one-shot instruction from the link that
  // opened the pane, and re-opening the pane by tapping the card should not
  // resurrect it.
  close: () => set({ isOpen: false, walletGuide: null }),
}));
