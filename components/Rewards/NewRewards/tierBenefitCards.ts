/** The benefit cards the rewards screen can show, in the order it shows them. */
export type TierBenefitKey = 'cashback' | 'referrals' | 'yield-boost' | 'subscription';

export interface TierBenefitAvailability {
  /** Extra APY the tier adds on top of the base savings yield, in points. */
  yieldBoostPercentage: number;
  /** Cashback % the tier earns back on eligible subscriptions. */
  subscriptionDiscountRate: number;
}

/**
 * Which benefit cards the user's CURRENT tier has actually unlocked.
 *
 * Cashback and referrals ship with every tier. The yield boost and subscription
 * cashback are tier-gated, and the backend reports a rate of 0 for a tier that
 * hasn't reached them — so a Core user gets two cards rather than four greyed
 * out ones for perks they can't use. The tier comparison screen is where
 * locked perks belong, since there the point is what's still to come.
 *
 * A missing or non-finite rate is treated as "not unlocked": showing a
 * "+undefined% Yield Boost" card is worse than showing no card.
 */
export const resolveTierBenefitKeys = ({
  yieldBoostPercentage,
  subscriptionDiscountRate,
}: TierBenefitAvailability): TierBenefitKey[] => {
  const keys: TierBenefitKey[] = ['cashback', 'referrals'];
  if (isUnlocked(yieldBoostPercentage)) keys.push('yield-boost');
  if (isUnlocked(subscriptionDiscountRate)) keys.push('subscription');
  return keys;
};

const isUnlocked = (rate: number) => Number.isFinite(rate) && rate > 0;

export interface TierBenefitRates extends TierBenefitAvailability {
  /** Ceiling on yield boost payouts for the tier, in USD. */
  yieldBoostCap: number;
  /** Yield boost payouts the user has actually received, in USD. */
  yieldBoostEarned: number;
}

/**
 * Stand-in rates for a perk the current tier hasn't unlocked, matching the
 * stock Prime configuration.
 *
 * Only ever reached on non-production builds (see {@link resolveTierBenefitRates}).
 * They are deliberately constants rather than a lookup against the live tier
 * config: qa and preview builds routinely run against a backend that predates
 * the yield-boost/subscription fields entirely, and a preview that only works
 * once the backend catches up is no use for reviewing the screen today. Real
 * numbers always win when the backend sends them.
 */
export const PREVIEW_BENEFIT_RATES = {
  yieldBoostPercentage: 2,
  yieldBoostCap: 50,
  subscriptionDiscountRate: 25,
} as const;

/**
 * The rates the benefit cards render with.
 *
 * In production this is exactly what the user's tier grants, so a locked perk
 * reports 0 and {@link resolveTierBenefitKeys} drops its card.
 *
 * When `previewLockedBenefits` is set — non-production builds only — a locked
 * perk borrows {@link PREVIEW_BENEFIT_RATES} instead, which lifts its rate above
 * zero and brings the card back. That lets design QA review the yield boost and
 * subscription cards on qa/staging/preview without holding a Prime or Ultra test
 * account. `yieldBoostEarned` is never substituted: a preview account really has
 * earned nothing, and $0 is the honest number to show.
 */
export const resolveTierBenefitRates = (
  rates: TierBenefitRates,
  previewLockedBenefits: boolean,
): TierBenefitRates => {
  if (!previewLockedBenefits) return rates;

  const hasBoost = isUnlocked(rates.yieldBoostPercentage);

  return {
    yieldBoostEarned: rates.yieldBoostEarned,
    yieldBoostPercentage: hasBoost
      ? rates.yieldBoostPercentage
      : PREVIEW_BENEFIT_RATES.yieldBoostPercentage,
    yieldBoostCap: hasBoost ? rates.yieldBoostCap : PREVIEW_BENEFIT_RATES.yieldBoostCap,
    subscriptionDiscountRate: isUnlocked(rates.subscriptionDiscountRate)
      ? rates.subscriptionDiscountRate
      : PREVIEW_BENEFIT_RATES.subscriptionDiscountRate,
  };
};

/**
 * Split cards into rows of two. A trailing odd card keeps its half-width column
 * rather than stretching across the row.
 */
export const chunkIntoRows = <T>(items: T[], perRow = 2): T[][] => {
  const rows: T[][] = [];
  for (let index = 0; index < items.length; index += perRow) {
    rows.push(items.slice(index, index + perRow));
  }
  return rows;
};
