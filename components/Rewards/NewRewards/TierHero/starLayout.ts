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

/**
 * Prime's star sits slightly high in its own canvas; nudge it back onto centre.
 *
 * Scaled by the size it is actually drawn at. The -5 was measured against the
 * 235px hero, where it is 2% of the height and invisible; applied flat to the
 * 28px star beside a heading it is 18%, which reads as a glyph that has come
 * loose from its own text. The nudge is a property of the artwork, so it has to
 * shrink with the artwork.
 */
export const tierStarOffset = (tier: RewardsTier, size: number = TIER_STAR_SIZES[tier]) =>
  tier === RewardsTier.PRIME
    ? [{ translateY: (-5 * size) / TIER_STAR_SIZES[RewardsTier.PRIME] }]
    : undefined;
