import type { CardCreditSummary, CardTransactionCardCredit } from '@/lib/types';

/**
 * Card credit presentation: the Home pills, the card credit sheet and the
 * purchase receipt. Card credit is never part of the balance — every figure here
 * is shown beside it, never added into it.
 */

const usd = (value: number) =>
  `$${(value || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** "$10" or "$9.40": cents only when there are any. */
const usdShort = (value: number) => {
  const amount = Math.round((value || 0) * 100) / 100;
  return Number.isInteger(amount) ? `$${amount.toLocaleString('en-US')}` : usd(amount);
};

/**
 * "+$0.35 today" — the yield estimate under the Home balance, in the balance's
 * currency (`symbol`, "$" by default). Null below half a cent, where it would
 * round to "+$0.00" and say nothing.
 */
export const dailyYieldPillLabel = (
  dailyYield: number | undefined,
  symbol = '$',
): string | null => {
  if (dailyYield === undefined || !Number.isFinite(dailyYield) || dailyYield < 0.005) return null;
  return `+${symbol}${usd(dailyYield).slice(1)} today`;
};

/**
 * Whether Home shows the card credit pill: only while there is credit left that
 * the user can actually spend — a user without an active Wirex card can hold
 * credit but has nothing to spend it with.
 */
export const showsCardCreditPill = (credit: CardCreditSummary | null | undefined): boolean =>
  !!credit && credit.spendable && credit.availableUsd > 0;

/** "$10 card credit". */
export const cardCreditPillLabel = (availableUsd: number): string =>
  `${usdShort(availableUsd)} card credit`;

/**
 * "From Dana's invite." — where the credit came from, newest grant first.
 * "From Dana's invite and 2 more." when several sources gave some.
 */
export const cardCreditSourceLine = (sources: CardCreditSummary['sources'] | undefined): string => {
  const labels = [...new Set((sources ?? []).map(source => source.label?.trim()).filter(Boolean))];
  if (labels.length === 0) return '';
  if (labels.length === 1) return `From ${labels[0]}.`;
  if (labels.length === 2) return `From ${labels[0]} and ${labels[1]}.`;
  return `From ${labels[0]} and ${labels.length - 1} more.`;
};

/** True when a card purchase used any card credit. */
export const usedCardCredit = (
  credit: CardTransactionCardCredit | undefined | null,
): credit is CardTransactionCardCredit => !!credit && credit.used_usd > 0;

/**
 * The USD a purchase's cashback is earned on: only the part paid from the
 * balance. Card credit earns none.
 */
export const cashbackBaseUsd = (
  purchaseUsd: number | null,
  credit: CardTransactionCardCredit | undefined | null,
): number | null => (usedCardCredit(credit) ? credit.from_balance_usd : purchaseUsd);
