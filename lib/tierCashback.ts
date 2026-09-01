import { RewardsTier } from '@/lib/types';

/**
 * The cashback % each tier advertises, held in the app instead of read from the
 * rewards API.
 *
 * Temporary. The rewards service still reports the pre-launch rates, so the
 * benefit card and the cashback modal quoted a number that contradicted the
 * tier comparison screen (which has always printed these). Until the
 * admin-configured rates are live, the app quotes one set of numbers
 * everywhere; flipping EXPO_PUBLIC_HARDCODED_TIER_CASHBACK to `false` hands
 * every surface back to the API without a code change, and this module can then
 * be deleted along with the flag.
 */
export const TIER_CASHBACK_RATES: Record<RewardsTier, number> = {
  [RewardsTier.CORE]: 3,
  [RewardsTier.PRIME]: 4,
  [RewardsTier.ULTRA]: 5,
};

/** "3%" / "4%" / "5%" — the rate as the tier screens print it. */
export const formatTierCashbackRate = (tier: RewardsTier): string =>
  `${TIER_CASHBACK_RATES[tier]}%`;

/**
 * The cashback % a surface should display.
 *
 * With the flag off this is exactly the rate the API reported, so turning the
 * override off restores the old behaviour precisely. With it on, the user's
 * current tier decides — except for a tier the app doesn't recognise (a backend
 * that has moved ahead of this build), where the API's own rate is still a
 * better answer than a blank one.
 *
 * A missing or non-finite API rate resolves to 0, which is what every caller
 * already coerced it to.
 */
export const resolveTierCashbackRate = (
  tier: RewardsTier | undefined,
  apiRate: number | undefined,
  useTierRates: boolean,
): number => {
  const apiFallback = typeof apiRate === 'number' && Number.isFinite(apiRate) ? apiRate : 0;
  if (!useTierRates || tier === undefined) return apiFallback;

  const tierRate: number | undefined = TIER_CASHBACK_RATES[tier];
  return typeof tierRate === 'number' && Number.isFinite(tierRate) ? tierRate : apiFallback;
};
