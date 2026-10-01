import { RewardsTier, TierBenefits } from '@/lib/types';

/**
 * Extra APY each tier adds on top of the base savings yield, in percentage
 * points — the app's fallback copy of what the accounts service pays from:
 * `YIELD_BOOST_DEFAULTS` in `app-config.constants.ts`, as the rewards service
 * reads it through `yieldBoostForTier` and `grantedBoostPercentage` (an APY of
 * 0.03 is the 3 quoted here).
 *
 * A fallback, not a second source of truth: every surface here prefers the
 * figure the tier-benefits endpoint sends and only falls back to this when the
 * request has not landed, or when the build is talking to a backend that does
 * not send `yieldBoostPercentage` at all.
 *
 * Kept because the tier comparison screen is reachable before that request
 * resolves, and a tier's headline benefit rendering as "+0%" for a beat reads
 * as a worse promise than the one being sold. Whenever this does disagree with
 * the backend, the backend is right — it is what actually pays out.
 */
export const TIER_YIELD_BOOST_RATES: Record<RewardsTier, number> = {
  [RewardsTier.CORE]: 0,
  [RewardsTier.PRIME]: 2,
  [RewardsTier.ULTRA]: 3,
};

/**
 * The boost a tier advertises, in percentage points.
 *
 * The live figure wins whenever the endpoint sent a usable one, so a rate
 * changed in admin config reaches the screens without a release. A tier that
 * genuinely grants no boost (Core) sends 0, which is a real answer rather than
 * a missing one — hence the explicit `Number.isFinite` check rather than a
 * truthiness test, which would quietly swap Core's 0 for the table's 0 and,
 * more importantly, would hide a backend that had switched a tier's boost off.
 */
export const resolveTierYieldBoostRate = (
  tier: RewardsTier,
  tierBenefits?: TierBenefits[],
): number => {
  const apiRate = tierBenefits?.find(entry => entry.tier === tier)?.yieldBoostPercentage;
  if (typeof apiRate === 'number' && Number.isFinite(apiRate)) return apiRate;
  return TIER_YIELD_BOOST_RATES[tier] ?? 0;
};

/** "+3%" — the boost as the tier screens print it. */
export const formatTierYieldBoost = (rate: number): string => `+${rate}%`;
