import { getTierAction } from '@/lib/rewardsUpgrade';

import type { TierUpgradeRoute } from '@/lib/tierUpgrade';
import type { RewardsTier } from '@/lib/types';

/** The button and the line above it, on the benefits pager's footer. */
export interface TierUpgradeCta {
  label: string;
  subtitle: string;
  /** Whether pressing it does anything. */
  enabled: boolean;
}

/** What the routes on offer are worth saying, above the button. */
const ROUTE_SUBTITLE: Record<string, string> = {
  'cash,lock': 'Lock soFUSE or pay the annual fee',
  lock: 'Lock soFUSE from your Savings to hold the tier',
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
  pending,
  routes,
  remainingFuse,
}: {
  selectedTier: RewardsTier;
  currentTier?: RewardsTier;
  /** No confirmed tier to compare against — the membership is still loading, or failed. */
  unavailable: boolean;
  /** An upgrade is already in flight and being reconciled. */
  pending: boolean;
  /** v3: the ways this tier is on sale right now. Empty when it is not. */
  routes: TierUpgradeRoute[];
  /** v2: the FUSE still needed to unlock it, or undefined when that is off. */
  remainingFuse?: number;
}): TierUpgradeCta => {
  if (pending) {
    return {
      label: 'Confirming tier…',
      subtitle: 'Savings changed. Waiting for rewards confirmation.',
      enabled: false,
    };
  }

  const action = getTierAction(selectedTier, currentTier, unavailable);

  if (action === 'current') {
    return { label: 'Current tier', subtitle: 'Your membership benefits', enabled: false };
  }

  if (action === 'included') {
    return {
      label: 'Included in your tier',
      subtitle: 'Your membership benefits',
      enabled: false,
    };
  }

  if (action === 'unavailable') {
    return {
      label: 'Tier unavailable',
      subtitle: 'Checking your current membership',
      enabled: false,
    };
  }

  if (routes.length > 0) {
    return {
      label: 'Upgrade',
      // Sorted so the key does not depend on the order the offer listed them in.
      subtitle: ROUTE_SUBTITLE[[...routes].sort().join(',')] ?? 'Upgrade to hold the tier',
      enabled: true,
    };
  }

  if (remainingFuse !== undefined) {
    return {
      label: 'Upgrade',
      subtitle: `Deposit ${remainingFuse.toLocaleString('en-US')} FUSE to Savings to upgrade`,
      enabled: true,
    };
  }

  // A higher tier that neither program is selling: the offer is switched off,
  // or this user is not eligible for it.
  return { label: 'Tier unavailable', subtitle: 'Your membership benefits', enabled: false };
};
