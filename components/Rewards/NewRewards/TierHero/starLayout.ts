import { RewardsTier } from '@/lib/types';

/**
 * The source animations have slightly different transparent padding. These
 * sizes reproduce each star's visible bounds in its 304 × 304 Figma
 * composition.
 */
export const TIER_STAR_SIZES: Record<RewardsTier, number> = {
  [RewardsTier.CORE]: 234,
  [RewardsTier.PRIME]: 235,
  [RewardsTier.ULTRA]: 236,
};

/** Prime's star sits slightly high in its own canvas; nudge it back onto centre. */
export const tierStarOffset = (tier: RewardsTier) =>
  tier === RewardsTier.PRIME ? [{ translateY: -5 }] : undefined;
