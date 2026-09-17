import { RewardsTier } from '@/lib/types';

const TIER_DISPLAY_NAMES: Record<RewardsTier, string> = {
  [RewardsTier.CORE]: 'Core',
  [RewardsTier.PRIME]: 'Prime',
  [RewardsTier.ULTRA]: 'Ultra',
};

/**
 * A tier's name as the product writes it — "Prime", not "prime".
 *
 * Lives here rather than in `constants/rewards` so the modules that only need
 * a tier's name can have it without pulling in the asset registry that file's
 * `getTierIcon` requires. `constants/rewards` re-exports it, so every existing
 * caller is unaffected.
 */
export const getTierDisplayName = (tier: RewardsTier): string => TIER_DISPLAY_NAMES[tier] || tier;
