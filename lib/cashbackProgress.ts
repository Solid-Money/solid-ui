import type { RewardsUserData } from '@/lib/types';

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

type MonthlyCapFields = Pick<
  RewardsUserData,
  'maxCashbackMonthly' | 'cashbackCapThisMonth' | 'cashbackHeadroomThisMonth'
>;

/**
 * The cap this month's figure is measured against: what this month's
 * purchases are actually paid up to.
 *
 * Usually the tier's cap. Larger after a trial ends mid-month: purchases made
 * during it keep the trial tier's cap, so a Prime trial member back on Core is
 * shown "$92 / $100" — what will land — rather than a bar overflowing "$50".
 * An older backend sends no month cap, and the tier's is what it always meant.
 */
export const monthlyCashbackCap = (data: MonthlyCapFields | undefined): number =>
  toPositive(data?.cashbackCapThisMonth ?? data?.maxCashbackMonthly);

/**
 * What a purchase made now can still add to this month, for the "spend $X more"
 * hint.
 *
 * Not simply cap minus earned: a new purchase is held to the cap of the tier
 * held now, so a month already past it (a trial's purchases, say) has nothing
 * left even when its own cap reads higher. Without a headroom figure it is
 * worked out the same way — against the tier's cap, not the month's — which on
 * an older backend, sending neither, is exactly the cap minus earned it was.
 */
export const monthlyCashbackHeadroom = (
  data: MonthlyCapFields | undefined,
  earned: number,
): number =>
  data?.cashbackHeadroomThisMonth !== undefined
    ? toPositive(data.cashbackHeadroomThisMonth)
    : Math.max(0, toPositive(data?.maxCashbackMonthly) - toPositive(earned));

/**
 * Whether a purchase made now can earn nothing more this month, so the hint
 * should say the cap is reached instead of asking for "$0 more" spend.
 *
 * That includes a bar that is not full: after a trial ends mid-month the month
 * can read "$92 / $100" with no headroom, the last $8 having been open only to
 * purchases made on the trial. Under a cent counts as none — it is all a
 * purchase could add, and a sum landing exactly on the cap can leave float
 * dust above zero.
 */
export const isMonthlyCashbackCapReached = (headroom: number): boolean =>
  toPositive(headroom) < 0.01;

/** A non-finite or negative amount contributes nothing rather than NaN. */
const toPositive = (value: number | undefined): number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0;
