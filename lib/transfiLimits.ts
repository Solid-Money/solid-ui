import { TransfiError } from '@/lib/transfiErrors';

import type { TransfiPaymentMethodOption, TransfiQuote } from '@/lib/types';

/**
 * Whether the amount in the box is one TransFi will price, worked out before it
 * is sent.
 *
 * TransFi refuses to quote an amount outside the limits, so an out-of-range
 * entry comes back as a *failed* quote — the breakdown collapses to dashes and
 * the button just stays disabled, with nothing saying why. The limits, though,
 * depend only on the currency and payment method, so they are known from the
 * payment method before a single quote is requested. That is what lets this run
 * on the keystroke instead of on the response.
 */
export interface AmountLimits {
  /** Fiat bounds for the selected currency + method. */
  minLimit?: number;
  maxLimit?: number;
  /** The same bounds in USDC, when a rate is known — the unit being typed in. */
  minUsdc?: number;
  maxUsdc?: number;
  belowMin: boolean;
  aboveMax: boolean;
}

export const resolveAmountLimits = ({
  amount,
  quote,
  quoteError,
  method,
  rate,
}: {
  /** The USDC amount as typed, not the debounced one. */
  amount: number;
  /** The quote for exactly this amount, if one has landed. */
  quote?: TransfiQuote;
  /** The quote request's failure, if it failed. */
  quoteError?: unknown;
  method?: TransfiPaymentMethodOption;
  /** Last exchange rate seen for this currency + method (fiat per USDC). */
  rate?: number;
}): AmountLimits => {
  const limitError =
    quoteError instanceof TransfiError && quoteError.action === 'adjust_amount'
      ? quoteError
      : undefined;

  const minLimit = quote?.minLimit ?? limitError?.details.minLimit ?? method?.minAmount;
  const maxLimit = quote?.maxLimit ?? limitError?.details.maxLimit ?? method?.maxAmount;

  const minUsdc = rate && minLimit != null ? minLimit / rate : undefined;
  const maxUsdc = rate && maxLimit != null ? maxLimit / rate : undefined;

  // Two comparisons, deliberately. The USDC one fires as the user types, before
  // the debounced quote is even requested. The fiat one is the exact check once
  // a quote lands — fees can push a total past a limit that the rate-converted
  // amount cleared.
  const fiatTotal = quote?.fiatAmount;
  return {
    minLimit,
    maxLimit,
    minUsdc,
    maxUsdc,
    belowMin:
      (minLimit != null && fiatTotal != null && fiatTotal < minLimit) ||
      (minUsdc != null && amount > 0 && amount < minUsdc),
    aboveMax:
      (maxLimit != null && fiatTotal != null && fiatTotal > maxLimit) ||
      (maxUsdc != null && amount > maxUsdc),
  };
};

/**
 * A fiat limit converted to USDC, rounded *into* the accepted range — a minimum
 * up, a maximum down. Rounding a 21.6 minimum down to 21.6 → "21.6" is fine, but
 * rounding it the other way would hand the user a number that fails the same
 * check again.
 */
export const formatUsdcBound = (value: number, round: 'up' | 'down'): string => {
  const rounded = round === 'up' ? Math.ceil(value * 100) / 100 : Math.floor(value * 100) / 100;
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(rounded);
};
