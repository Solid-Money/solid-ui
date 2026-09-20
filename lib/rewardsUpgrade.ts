import { RewardsTier } from '@/lib/types';

const ranks: Record<RewardsTier, number> = { core: 0, prime: 1, ultra: 2 };

export const isHigherTier = (tier?: RewardsTier, current?: RewardsTier) =>
  tier !== undefined && current !== undefined && ranks[tier] > ranks[current];

export const getTierAction = (
  selected: RewardsTier,
  current?: RewardsTier,
  unavailable = false,
) => {
  if (!current || unavailable) return 'unavailable';
  if (selected === current) return 'current';
  return isHigherTier(selected, current) ? 'upgrade' : 'included';
};

// Runs beyond the backend's 60-second soFUSE balance cache, then stops.
export const REWARDS_RECONCILIATION_MS = 90_000;
export const REWARDS_RECONCILIATION_INTERVAL_MS = 5_000;

/** The screens that buy a tier, as `usePathname` reports them. */
const UPGRADE_FLOW_ROUTES = ['/rewards/upgrade', '/rewards/upgrade-review'];

/**
 * Whether the user is part-way through buying a tier.
 *
 * The upgrade celebration is mounted on the protected layout, so it draws over
 * whatever screen is up — including the review screen, where it announced a
 * tier while the user was still deciding whether to sign for it. The upgrade
 * flow is the one place it must never appear: either nothing has been bought
 * yet, or the purchase is mid-flight and `router.replace` is about to put the
 * user on Rewards, which is where the card belongs.
 *
 * Suppression, not cancellation. `success` stays in the store until it is
 * dismissed, so the card shows the moment the flow is left.
 */
export const isUpgradeFlowRoute = (pathname?: string | null) =>
  !!pathname && UPGRADE_FLOW_ROUTES.includes(pathname.replace(/\/+$/, ''));
