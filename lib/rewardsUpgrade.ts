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
