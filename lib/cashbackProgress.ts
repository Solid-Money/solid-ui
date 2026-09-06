/**
 * How the cashback surfaces present a month's earnings.
 *
 * Cashback settles days after the purchase, so a month's figure is part settled
 * and part still in escrow. The app presents the two as one number: the split
 * is a fact about our payout timing, not about what the cardholder earned, and
 * showing it twice — once as "earned", once as "pending" — invited the reading
 * that the pending half might not arrive.
 *
 * The API still reports them separately (`cashbackThisMonth` and
 * `cashbackPendingThisMonth`), because the cap is enforced against what has
 * actually been paid. Summing is a presentation decision, made here so no
 * surface can disagree with another about the headline figure.
 */

/** The green every cashback figure and the progress fill are drawn in. */
export const CASHBACK_EARNED_COLOR = '#94F27F';

/**
 * A month's cashback as the app shows it: settled plus still-escrowed.
 *
 * A missing pending figure — an older backend — contributes nothing, which
 * leaves the settled figure exactly as it read before projections existed.
 */
export const monthlyCashbackTotal = (
  earned: number | undefined,
  pending: number | undefined,
): number => toPositive(earned) + toPositive(pending);

/**
 * How much of the monthly cap the figure fills, 0-100.
 *
 * A cap of 0 fills nothing: with nothing to measure against, a full bar would
 * claim the cardholder had maxed out a cap that isn't configured.
 */
export const resolveCashbackProgress = (total: number, cap: number): number => {
  const safeCap = toPositive(cap);
  if (safeCap === 0) return 0;

  return Math.min(100, (toPositive(total) / safeCap) * 100);
};

/** A non-finite or negative amount contributes nothing rather than NaN. */
const toPositive = (value: number | undefined): number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0;
