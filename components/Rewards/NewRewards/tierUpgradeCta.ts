import { getTierAction } from '@/lib/rewardsUpgrade';

import type { TierUpgradeRoute } from '@/lib/tierUpgrade';
import type { RewardsTier } from '@/lib/types';

/** The button and the line above it, on the benefits pager's footer. */
export interface TierUpgradeCta {
  label: string;
  subtitle: string;
  /** Whether pressing it does anything. */
  enabled: boolean;
  /**
   * The user already has this tier — either it is the one they hold, or it is
   * below it and comes with theirs.
   *
   * The footer hides outright on this rather than disabling itself. A greyed-out
   * "Current tier" button is a call to action that says there is no action, put
   * where the eye goes last on the page, and it costs the benefits list the
   * bottom of the screen to say nothing.
   */
  held: boolean;
}

/** What the routes on offer are worth saying, above the button. */
const ROUTE_SUBTITLE: Record<string, string> = {
  'cash,lock': 'Lock FUSE or pay the annual fee',
  lock: 'Lock FUSE to hold the tier',
  cash: 'Pay the annual fee to hold the tier',
};

/**
 * The benefits pager's upgrade CTA, resolved in one place.
 *
 * It reads two programs at once and has to pick the live one. Under v3 a tier
 * is *sold* — a lock or an annual fee, priced by the membership endpoint — and
 * the button opens the upgrade flow. Under v2 it is *unlocked* by a FUSE
 * balance, and the button opens the deposit sheet. The screen ran only the
 * second test, so with v3 switched on and the v2 skip-the-line config off, the
 * only tier anyone could buy read "Tier unavailable" with the offer sitting one
 * endpoint away.
 *
 * Purchasability is therefore checked against whichever program is answering:
 * `routes` for v3, `remainingFuse` for v2. Neither is a fallback for the other
 * — they are different products — but a tier that either one can sell is a tier
 * the user can buy, and the button says so.
 */
export const tierUpgradeCta = ({
  selectedTier,
  currentTier,
  unavailable,
  loadFailed = false,
  pending,
  routes,
  annualFeeUsd,
  lockFuse,
  remainingFuse,
  offerHeld = false,
}: {
  selectedTier: RewardsTier;
  currentTier?: RewardsTier;
  /** No confirmed tier to compare against. */
  unavailable: boolean;
  /** The rewards request settled unsuccessfully, so the CTA should offer recovery. */
  loadFailed?: boolean;
  /** An upgrade is already in flight and being reconciled. */
  pending: boolean;
  /** v3: the ways this tier is on sale right now. Empty when it is not. */
  routes: TierUpgradeRoute[];
  /** The membership offer's cash price, used in the combined-route subtitle. */
  annualFeeUsd?: number | null;
  /** The membership offer's full lock requirement. */
  lockFuse?: number;
  /** v2: the FUSE still needed to unlock it, or undefined when that is off. */
  remainingFuse?: number;
  /**
   * The membership endpoint's own verdict on whether this tier is already the
   * user's (`offer.held`).
   *
   * A second opinion on purpose. `currentTier` comes from the rewards endpoint
   * and this from the membership one; both are the backend's single answer, but
   * they are two requests with two caches, so one can be a beat behind the
   * other. Either saying "they have it" is enough to stop offering it, because
   * offering a tier someone already holds is the worse of the two mistakes.
   */
  offerHeld?: boolean;
}): TierUpgradeCta => {
  const action = getTierAction(selectedTier, currentTier, unavailable);
  const held = offerHeld || action === 'current' || action === 'included';

  // Checked before `pending`: a reconciliation that has landed is over, and
  // holding "Confirming tier…" on screen after the membership has agreed is
  // just a slower way of saying nothing.
  if (held) {
    return {
      // The footer hides on `held` rather than rendering either of these. They
      // keep their copy because the flag is what the caller acts on, not the
      // text, and so the labels are still right if it ever renders them again.
      label: action === 'included' ? 'Included in your tier' : 'Current tier',
      subtitle: 'Your membership benefits',
      enabled: false,
      held: true,
    };
  }

  if (pending) {
    return {
      label: 'Confirming tier…',
      subtitle: 'Savings changed. Waiting for rewards confirmation.',
      enabled: false,
      held: false,
    };
  }

  if (loadFailed) {
    return {
      label: 'Try again',
      subtitle: 'Unable to load your membership',
      enabled: true,
      held: false,
    };
  }

  // Not "you have it" — we do not yet know what they have. The membership is
  // still loading. The caller keeps the footer out of the layout during this
  // state, so this is a fail-closed fallback rather than user-facing copy.
  if (action === 'unavailable') {
    return {
      label: 'Tier unavailable',
      subtitle: 'Checking your current membership',
      enabled: false,
      held: false,
    };
  }

  if (routes.length > 0) {
    const routeKey = [...routes].sort().join(',');
    const fuseAmount = lockFuse != null && lockFuse > 0 ? `${lockFuse / 1000}k` : undefined;
    const pricedSubtitle =
      routeKey === 'cash,lock' && annualFeeUsd != null && annualFeeUsd > 0 && fuseAmount
        ? `${annualFeeUsd}$/Year or ${fuseAmount} FUSE to upgrade`
        : routeKey === 'lock' && fuseAmount
          ? `Deposit ${fuseAmount} FUSE to upgrade`
          : undefined;

    return {
      label: 'Upgrade',
      // Sorted so the key does not depend on the order the offer listed them in.
      subtitle: pricedSubtitle ?? ROUTE_SUBTITLE[routeKey] ?? 'Upgrade to hold the tier',
      enabled: true,
      held: false,
    };
  }

  if (remainingFuse !== undefined) {
    return {
      label: 'Upgrade',
      subtitle: `Deposit ${remainingFuse.toLocaleString('en-US')} FUSE to Savings to upgrade`,
      enabled: true,
      held: false,
    };
  }

  // A higher tier that neither program is selling: both routes are switched
  // off, or this user is not eligible for it.
  //
  // The subtitle used to read "Your membership benefits", borrowed from the two
  // held cases above — which told a user looking at a tier they do NOT have
  // that they were looking at their own benefits. This is the one case where
  // "Tier unavailable" is literally true, so it says why.
  return {
    label: 'Tier unavailable',
    subtitle: 'Not on sale right now',
    enabled: false,
    held: false,
  };
};
