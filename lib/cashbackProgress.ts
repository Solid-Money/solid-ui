import type { CashbackCurrency, CashbackData, RewardsUserData } from '@/lib/types';

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

/**
 * This month's cashback and caps in one currency — the cardholder's — which is
 * what every helper above measures. Same field names as the rewards data, so
 * `monthlyCashbackCap` and `monthlyCashbackHeadroom` take it as they are.
 */
export type CashbackMonth = MonthlyCapFields &
  Pick<RewardsUserData, 'cashbackThisMonth' | 'cashbackPendingThisMonth'> & {
    currency: CashbackCurrency;
  };

/**
 * The month figures to show: a euro cardholder's from `cashbackEur`, in EUR —
 * euro caps, euro headroom, euro earnings — and everyone else's from the
 * top-level USD fields, exactly as before. Never a mix: a figure and the cap it
 * is measured against are always in the same currency.
 *
 * A euro cardholder whose euro block is missing falls back to the USD fields
 * and says so through `currency`, rather than printing dollar figures with €.
 */
export const resolveCashbackMonth = (
  rewards: RewardsUserData | undefined,
): CashbackMonth | undefined => {
  if (!rewards) return undefined;
  if (rewards.cashbackCurrency === 'EUR' && rewards.cashbackEur) {
    return { ...rewards.cashbackEur, currency: 'EUR' };
  }
  return {
    currency: 'USD',
    cashbackThisMonth: rewards.cashbackThisMonth,
    cashbackPendingThisMonth: rewards.cashbackPendingThisMonth,
    maxCashbackMonthly: rewards.maxCashbackMonthly,
    cashbackCapThisMonth: rewards.cashbackCapThisMonth,
    cashbackHeadroomThisMonth: rewards.cashbackHeadroomThisMonth,
  };
};

/** An amount and the currency it is in. */
export interface CashbackFigure {
  value: number;
  currency: CashbackCurrency;
}

/**
 * Per-currency amounts as figures to print side by side ("€12.40 + $150.00"),
 * the cardholder's own currency first. They are never added together.
 *
 * The cardholder's own currency is always listed, even at zero; the other only
 * when there is something in it.
 */
export const cashbackFiguresByCurrency = (
  amounts: Partial<Record<CashbackCurrency, number>>,
  currency: CashbackCurrency,
): CashbackFigure[] => {
  const other: CashbackCurrency = currency === 'EUR' ? 'USD' : 'EUR';
  const figures: CashbackFigure[] = [{ value: toPositive(amounts[currency]), currency }];
  const otherValue = toPositive(amounts[other]);
  if (otherValue > 0) figures.push({ value: otherValue, currency: other });
  return figures;
};

/**
 * One currency's lifetime cashback: everything paid plus what is still in
 * escrow.
 *
 * Escrow counts for the same reason it does in the month's figure: leaving it
 * out read $0 for the fortnight a new cardholder's first purchase takes to
 * mature, and put the lifetime below the month shown in the same sheet.
 *
 * `fromBackend` is the backend's figure, worked out over every card the
 * cardholder has held, paid and escrowed together in one read. Without it — an
 * older backend, or a paid total it couldn't read — the card details' paid
 * total stands in, and is only ever floored at the month's figure, never added
 * to it: the card details and the rewards data are fetched and cached apart, so
 * a payout can already be in the first and still pending in the second.
 * That fallback is a lower bound: it can trail escrow from last month or on top
 * of earlier history, but it never counts a payout twice.
 *
 * Never below this month's figure in the same currency.
 */
const laneLifetime = (
  fromBackend: number | undefined,
  paidOnCard: number | undefined,
  month: { cashbackThisMonth?: number; cashbackPendingThisMonth?: number } | undefined,
): number => {
  const thisMonth = monthlyCashbackTotal(month?.cashbackThisMonth, month?.cashbackPendingThisMonth);
  const lifetime =
    typeof fromBackend === 'number' ? toPositive(fromBackend) : toPositive(paidOnCard);
  return Math.max(lifetime, thisMonth);
};

/**
 * Lifetime cashback, per currency — the rewards card's headline and the
 * cashback sheet's "Lifetime cashback" row: `lifetimeCashback` in the month's
 * currency, and `lifetimeCashbackOther` when the cardholder also has cashback
 * in the other one — shown beside it, never added to it. See `laneLifetime`
 * for what each figure counts.
 */
export const resolveLifetimeCashback = (
  rewards: RewardsUserData | undefined,
  cardCashback: CashbackData | undefined,
): { lifetimeCashback: number; lifetimeCashbackOther?: CashbackFigure } => {
  const currency = resolveCashbackMonth(rewards)?.currency ?? 'USD';
  const [own, other] = cashbackFiguresByCurrency(
    {
      USD: laneLifetime(rewards?.cashbackLifetime, cardCashback?.totalUsdValue, rewards),
      EUR: laneLifetime(
        rewards?.cashbackEur?.cashbackLifetime,
        cardCashback?.eur?.totalEurValue,
        rewards?.cashbackEur,
      ),
    },
    currency,
  );
  return { lifetimeCashback: own.value, lifetimeCashbackOther: other };
};

/** A non-finite or negative amount contributes nothing rather than NaN. */
const toPositive = (value: number | undefined): number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0;
