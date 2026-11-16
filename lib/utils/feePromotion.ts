/**
 * Fee promotions and the bank deposit fee line, as the app shows them.
 *
 * Free of React and UI imports so it can be unit-tested directly — the
 * `@/lib/utils` barrel would drag in wagmi's ESM build, which Jest cannot
 * parse. Same split as depositFee.ts.
 *
 * Mirrors solid-backend:
 *  - GET /accounts/v1/product-fees/promotions (UserFeePromotionsResponseDto)
 *  - the `metadata.fee` a Wirex bank deposit's activity carries once it is
 *    priced (WirexDepositFeeSummary in wirex-bank-activity.service.ts)
 */

/** The promotion that makes SEPA deposits to the euro account free. */
export const EUR_BANK_DEPOSIT_PROMOTION_SCOPE = 'eur_bank_deposit';

/** Mirrors ProductFeeWaiveReason on the backend. */
export const FEE_WAIVE_REASON_PROMOTION = 'Promotion';
export const FEE_WAIVE_REASON_TIER_FREE = 'TierFree';

/** A live fee promotion, as one user sees it. */
export interface UserFeePromotion {
  id: string;
  name: string;
  scope: string;
  product: string;
  currency: string;
  freeCountPerUser: number;
  used: number;
  remaining: number;
  /** ISO 8601. The window is [startsAt, endsAt). */
  startsAt: string;
  endsAt: string;
}

export interface UserFeePromotionsResponse {
  promotions: UserFeePromotion[];
}

/** What a bank deposit was charged, from its activity's `metadata.fee`. */
export interface BankDepositFeeSummary {
  /** Our fee, withheld from the payout. "0.00" when nothing was taken. */
  amount: string;
  currency: string;
  /** What reached the user's Solid account. */
  creditedAmount: string;
  creditedToken: string;
  waiveReason?: string;
  /** What the fee would have been, when a promotion covered it. */
  waivedAmount?: string;
  promotion?: { id: string; name?: string; slot: number; freeCount?: number };
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const CURRENCY_SYMBOLS: Record<string, string> = { EUR: '€', USD: '$', GBP: '£' };

const isNonNegativeDecimal = (value: unknown): value is string =>
  typeof value === 'string' && /^\d+(\.\d+)?$/.test(value);

/**
 * The promotion making this user's euro account deposits free right now, if
 * they have any free deposits left under it. The response is treated as
 * untrusted: anything malformed is ignored rather than shown.
 */
export function eurDepositPromotion(
  response: UserFeePromotionsResponse | null | undefined,
  now: number = Date.now(),
): UserFeePromotion | null {
  const promotions = Array.isArray(response?.promotions) ? response.promotions : [];
  return (
    promotions.find(promotion => {
      if (!promotion || promotion.scope !== EUR_BANK_DEPOSIT_PROMOTION_SCOPE) return false;
      const end = Date.parse(promotion.endsAt);
      const start = Date.parse(promotion.startsAt);
      return (
        Number.isInteger(promotion.remaining) &&
        promotion.remaining > 0 &&
        Number.isFinite(end) &&
        Number.isFinite(start) &&
        start <= now &&
        now < end
      );
    }) ?? null
  );
}

/**
 * When {@link eurDepositPromotion}'s answer next changes on the clock alone —
 * the nearest start or end of a euro deposit promotion still ahead of `now` —
 * or null when none will.
 */
export function nextEurPromotionChange(
  response: UserFeePromotionsResponse | null | undefined,
  now: number = Date.now(),
): number | null {
  const promotions = Array.isArray(response?.promotions) ? response.promotions : [];
  let next: number | null = null;
  for (const promotion of promotions) {
    if (!promotion || promotion.scope !== EUR_BANK_DEPOSIT_PROMOTION_SCOPE) continue;
    for (const boundary of [promotion.startsAt, promotion.endsAt]) {
      const at = Date.parse(boundary);
      if (Number.isFinite(at) && at > now && (next === null || at < next)) next = at;
    }
  }
  return next;
}

/**
 * The last day a promotion covers, as "31 Dec", in UTC — the window is
 * [start, end), so an end at midnight on 1 Jan means 31 Dec is the last day.
 * Worked out by hand rather than with Intl's `timeZone`, which Hermes does not
 * support everywhere.
 */
export function promotionLastDay(endsAt: string): string {
  const end = Date.parse(endsAt);
  if (!Number.isFinite(end)) return '';
  const last = new Date(end - 1);
  return `${last.getUTCDate()} ${MONTHS[last.getUTCMonth()]}`;
}

/** The headline and the line under it, for the euro account screen. */
export function eurDepositPromotionCopy(promotion: UserFeePromotion): {
  title: string;
  body: string;
} {
  const count = promotion.remaining;
  const lastDay = promotionLastDay(promotion.endsAt);
  return {
    title:
      count === 1 ? 'Your next SEPA deposit is free' : `Your next ${count} SEPA deposits are free`,
    body:
      `€0 fee on ${count === 1 ? 'it' : 'them'}, whatever your plan` +
      (lastDay ? `. Offer ends ${lastDay}.` : '.'),
  };
}

/**
 * The fee summary on a bank deposit's activity, or null when there is none
 * (a deposit priced before the app could show fees, or not priced yet).
 */
export function readBankDepositFee(metadata: unknown): BankDepositFeeSummary | null {
  const fee = (metadata as { fee?: unknown } | null | undefined)?.fee as
    | Partial<BankDepositFeeSummary>
    | undefined;
  if (!fee || typeof fee !== 'object') return null;
  if (!isNonNegativeDecimal(fee.amount) || typeof fee.currency !== 'string') return null;

  const promotion =
    fee.promotion &&
    typeof fee.promotion === 'object' &&
    typeof fee.promotion.id === 'string' &&
    Number.isInteger(fee.promotion.slot)
      ? {
          id: fee.promotion.id,
          slot: fee.promotion.slot,
          ...(typeof fee.promotion.name === 'string' && { name: fee.promotion.name }),
          ...(Number.isInteger(fee.promotion.freeCount) && {
            freeCount: fee.promotion.freeCount,
          }),
        }
      : undefined;

  return {
    amount: fee.amount,
    currency: fee.currency.toUpperCase(),
    creditedAmount: isNonNegativeDecimal(fee.creditedAmount) ? fee.creditedAmount : '',
    creditedToken: typeof fee.creditedToken === 'string' ? fee.creditedToken : '',
    ...(typeof fee.waiveReason === 'string' && { waiveReason: fee.waiveReason }),
    ...(isNonNegativeDecimal(fee.waivedAmount) && { waivedAmount: fee.waivedAmount }),
    ...(promotion && { promotion }),
  };
}

/** "€0.50", or "0.50 CHF" for a currency without a symbol here. */
export function formatFiat(amount: string, currency: string): string {
  const symbol = CURRENCY_SYMBOLS[currency.toUpperCase()];
  return symbol ? `${symbol}${amount}` : `${amount} ${currency.toUpperCase()}`;
}

/**
 * The fee row on a bank deposit: the amount — €0.00 on a free one, so the
 * user sees the benefit — and, when nothing was taken, why.
 */
export function bankDepositFeeLine(fee: BankDepositFeeSummary): {
  value: string;
  note?: string;
} {
  const value = formatFiat(fee.amount, fee.currency);
  if (Number(fee.amount) > 0) return { value };

  if (fee.waiveReason === FEE_WAIVE_REASON_PROMOTION) {
    const which = fee.promotion
      ? fee.promotion.freeCount
        ? `Free deposit ${fee.promotion.slot} of ${fee.promotion.freeCount}`
        : 'Free deposit'
      : 'Free deposit';
    const saved =
      fee.waivedAmount && Number(fee.waivedAmount) > 0
        ? ` · you saved ${formatFiat(fee.waivedAmount, fee.currency)}`
        : '';
    return { value, note: `${which}${saved}` };
  }
  if (fee.waiveReason === FEE_WAIVE_REASON_TIER_FREE) {
    return { value, note: 'Free on your plan' };
  }
  return { value };
}
