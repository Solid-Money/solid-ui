import { IS_TIER_CASHBACK_HARDCODED } from '@/lib/config';
import { RewardsTier, RewardsUserData } from '@/lib/types';

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
 *
 * @param hasCustomRate Whether `apiRate` is a rate pinned to this individual
 * user rather than their tier's. Support can set one per account, and it is
 * what their spend actually earns — so it wins over the launch table even while
 * the flag is on, which is the one case where "quote one set of numbers
 * everywhere" would quote a number we are not going to pay.
 */
export const resolveTierCashbackRate = (
  tier: RewardsTier | undefined,
  apiRate: number | undefined,
  useTierRates: boolean,
  hasCustomRate = false,
): number => {
  const apiFallback = typeof apiRate === 'number' && Number.isFinite(apiRate) ? apiRate : 0;
  if (!useTierRates || tier === undefined) return apiFallback;
  // A rate pinned to this user only counts if the API actually sent one; the
  // flag with no usable number is still better answered by the tier table.
  if (hasCustomRate && typeof apiRate === 'number' && Number.isFinite(apiRate)) {
    return apiRate;
  }

  const tierRate: number | undefined = TIER_CASHBACK_RATES[tier];
  return typeof tierRate === 'number' && Number.isFinite(tierRate) ? tierRate : apiFallback;
};

/**
 * The cashback % to show for the signed-in user, from their rewards data.
 *
 * Every surface that quotes a rate reads this rather than
 * {@link resolveTierCashbackRate} directly: the three fields it needs travel
 * together on one response, and passing them one at a time is how a screen ends
 * up quoting a tier rate to somebody support has put on a different one.
 *
 * @param tier Overrides the tier on `rewardsData`, for a screen that has already
 * resolved one (defaulting to Core while the request is in flight, say).
 */
export const resolveUserCashbackRate = (
  rewardsData: RewardsUserData | undefined,
  tier: RewardsTier | undefined = rewardsData?.currentTier,
): number =>
  resolveTierCashbackRate(
    tier,
    rewardsData?.cashbackRate,
    IS_TIER_CASHBACK_HARDCODED,
    rewardsData?.hasCustomCashbackRate,
  );
