import { create } from 'zustand';

import { TIER_UPGRADE_MODAL } from '@/constants/modals';
import { DEFAULT_LOCK_ASSET, type LockPaymentAsset } from '@/lib/tierLockPayment';
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
  /**
   * The token the lock is paid with.
   *
   * Deliberately the user's choice rather than a balance the app picks for
   * them: all three are FUSE to the tier, but they are not interchangeable to
   * the person holding them — someone keeping FUSE liquid on purpose should not
   * have their Savings spent instead, and vice versa.
   */
  lockAsset: LockPaymentAsset;
  open: (tier?: PurchasableTier | null) => void;
  review: () => void;
  selectToken: () => void;
  back: () => void;
  close: () => void;
  setRoute: (route: TierUpgradeRoute) => void;
  setLockAsset: (asset: LockPaymentAsset) => void;
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
  lockAsset: DEFAULT_LOCK_ASSET,

  open: (tier = null) =>
    set({
      previousModal: get().currentModal,
      currentModal: TIER_UPGRADE_MODAL.OPEN_UPGRADE,
      tier,
      // Cleared, not kept: the route on offer depends on the tier, and a "Cash"
      // tab held over from a previous tier is a payment method this one may not
      // sell. The upgrade step settles it again from the offer.
      route: null,
      // Back to the default too. A token picked for one upgrade is not a
      // standing preference, and the balances behind it have moved since.
      lockAsset: DEFAULT_LOCK_ASSET,
    }),

  review: () =>
    set({
      previousModal: get().currentModal,
      currentModal: TIER_UPGRADE_MODAL.OPEN_REVIEW,
    }),

  selectToken: () =>
    set({
      previousModal: get().currentModal,
      currentModal: TIER_UPGRADE_MODAL.OPEN_TOKEN_SELECTOR,
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

  // Picking one closes the picker: it is a one-tap choice, and making the user
  // press back afterwards is a step that exists only because the screen is a
  // separate one.
  setLockAsset: asset =>
    set({
      lockAsset: asset,
      previousModal: get().currentModal,
      currentModal: TIER_UPGRADE_MODAL.OPEN_UPGRADE,
    }),
}));

/** Whether the upgrade flow is on screen. */
export const isTierUpgradeOpen = (state: TierUpgradeState) =>
  state.currentModal.name !== TIER_UPGRADE_MODAL.CLOSE.name;
