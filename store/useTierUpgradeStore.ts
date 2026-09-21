import { create } from 'zustand';

import { TIER_UPGRADE_MODAL } from '@/constants/modals';
import { RewardsTier } from '@/lib/types';

import type { ModalState } from '@/components/ResponsiveModal';
import type { TierUpgradeRoute } from '@/lib/tierUpgrade';

/** The two tiers that are for sale. Core is what you have before you buy one. */
export type PurchasableTier = RewardsTier.PRIME | RewardsTier.ULTRA;

interface TierUpgradeState {
  currentModal: ModalState;
  previousModal: ModalState;
  /**
   * The tier being bought, or null for "whichever one is next".
   *
   * Null is what the Earn screen's CTA opens with: it knows the user wants to
   * upgrade and has no idea which tier that means, and resolving it there would
   * mean loading the membership on a screen that otherwise never asks for it.
   */
  tier: PurchasableTier | null;
  /**
   * How they are paying, once they have chosen.
   *
   * Lives here rather than in the upgrade step so the review step can read it:
   * the review is a sibling, not a child, and passing it down through the modal
   * provider would make the provider know what a payment route is.
   */
  route: TierUpgradeRoute | null;
  open: (tier?: PurchasableTier | null) => void;
  review: () => void;
  back: () => void;
  close: () => void;
  setRoute: (route: TierUpgradeRoute) => void;
}

/**
 * The tier upgrade flow, as one modal opened from anywhere.
 *
 * Global for the same reason `useUnstakeStore` is: the entry points are on
 * three different screens, and a modal per entry point is a stack of overlays
 * the moment two of those screens are mounted at once.
 */
export const useTierUpgradeStore = create<TierUpgradeState>()((set, get) => ({
  currentModal: TIER_UPGRADE_MODAL.CLOSE,
  previousModal: TIER_UPGRADE_MODAL.CLOSE,
  tier: null,
  route: null,

  open: (tier = null) =>
    set({
      previousModal: get().currentModal,
      currentModal: TIER_UPGRADE_MODAL.OPEN_UPGRADE,
      tier,
      // Cleared, not kept: the route on offer depends on the tier, and a "Cash"
      // tab held over from a previous tier is a payment method this one may not
      // sell. The upgrade step settles it again from the offer.
      route: null,
    }),

  review: () =>
    set({
      previousModal: get().currentModal,
      currentModal: TIER_UPGRADE_MODAL.OPEN_REVIEW,
    }),

  back: () =>
    set({
      previousModal: get().currentModal,
      currentModal: TIER_UPGRADE_MODAL.OPEN_UPGRADE,
    }),

  close: () =>
    set({
      previousModal: get().currentModal,
      currentModal: TIER_UPGRADE_MODAL.CLOSE,
    }),

  setRoute: route => set({ route }),
}));

/** Whether the upgrade flow is on screen. */
export const isTierUpgradeOpen = (state: TierUpgradeState) =>
  state.currentModal.name !== TIER_UPGRADE_MODAL.CLOSE.name;
