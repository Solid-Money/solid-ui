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
  const unlocked = (rate: number) => Number.isFinite(rate) && rate > 0;

  const keys: TierBenefitKey[] = ['cashback', 'referrals'];
  if (unlocked(yieldBoostPercentage)) keys.push('yield-boost');
  if (unlocked(subscriptionDiscountRate)) keys.push('subscription');
  return keys;
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
