/// <reference types="jest" />

import { TransfiError } from '@/lib/transfiErrors';
import { formatUsdcBound, resolveAmountLimits } from '@/lib/transfiLimits';

import type { TransfiPaymentMethodOption, TransfiQuote } from '@/lib/types';

/** SEPA Instant in EUR, as the payment-methods endpoint returns it. */
const method: TransfiPaymentMethodOption = {
  paymentCode: 'sepa_instant',
  minAmount: 22,
  maxAmount: 86351.62,
};

/** A priced quote: 100 USDC costs 86.46 EUR at ~1.1583 EUR per USDC. */
const quote = (overrides: Partial<TransfiQuote> = {}): TransfiQuote => ({
  fiatCurrency: 'EUR',
  cryptoCurrency: 'USDC',
  usdcAmount: '100',
  paymentCode: 'sepa_instant',
  exchangeRate: 1.1583,
  fiatAmount: 86.46,
  minLimit: 22,
  maxLimit: 86351.62,
  ...overrides,
});

const limitFailure = () =>
  new TransfiError('QUOTES_LIMIT_ERROR', 'adjust_amount', 'outside the limits', 400, {
    minLimit: 22,
    maxLimit: 86351.62,
    fiatCurrency: 'EUR',
  });

describe('resolveAmountLimits', () => {
  it('knows the range before any quote has been requested', () => {
    // The whole point: the user should see 22–86,351.62 the moment they pick a
    // method, not after a round trip that fails.
    expect(resolveAmountLimits({ amount: 0, method })).toMatchObject({
      minLimit: 22,
      maxLimit: 86351.62,
      belowMin: false,
      aboveMax: false,
    });
  });

  it('flags an amount below the minimum on the keystroke, using the last rate', () => {
    // 10 USDC ≈ 11.58 EUR, under the 22 EUR floor — caught without a quote.
    const limits = resolveAmountLimits({ amount: 10, method, rate: 1.1583 });

    expect(limits.belowMin).toBe(true);
    expect(limits.aboveMax).toBe(false);
    expect(limits.minUsdc).toBeCloseTo(18.99, 2);
  });

  it('flags an amount above the maximum on the keystroke', () => {
    const limits = resolveAmountLimits({ amount: 100_000, method, rate: 1.1583 });

    expect(limits.aboveMax).toBe(true);
    expect(limits.maxUsdc).toBeCloseTo(74550.31, 2);
  });

  it('accepts an amount inside the range', () => {
    const limits = resolveAmountLimits({ amount: 100, quote: quote(), method, rate: 1.1583 });

    expect(limits).toMatchObject({ belowMin: false, aboveMax: false });
  });

  it('trusts the quoted fiat total over the rate conversion', () => {
    // Fees are in the total but not in the rate, so an amount that clears the
    // converted floor can still land under the real one.
    const limits = resolveAmountLimits({
      amount: 19,
      quote: quote({ usdcAmount: '19', fiatAmount: 21.9 }),
      method,
      rate: 1.1583,
    });

    expect(limits.belowMin).toBe(true);
  });

  it('takes the limits from a rejected quote when nothing else has them', () => {
    const limits = resolveAmountLimits({
      amount: 1,
      quoteError: limitFailure(),
      rate: 1.1583,
    });

    expect(limits).toMatchObject({ minLimit: 22, maxLimit: 86351.62, belowMin: true });
  });

  it('ignores a failure that is not about the amount', () => {
    // A 502 says nothing about the limits; treating it as one would put a
    // "change your amount" message on a problem the amount didn't cause.
    const limits = resolveAmountLimits({
      amount: 100,
      quoteError: new TransfiError('INTERNAL_SERVER_ERROR', 'retry', 'upstream down', 502),
      method,
      rate: 1.1583,
    });

    expect(limits).toMatchObject({ belowMin: false, aboveMax: false });
  });

  it('reports no verdict when there is no rate and no method to bound with', () => {
    expect(resolveAmountLimits({ amount: 100 })).toEqual({
      minLimit: undefined,
      maxLimit: undefined,
      minUsdc: undefined,
      maxUsdc: undefined,
      belowMin: false,
      aboveMax: false,
    });
  });

  it('does not call an empty box too small', () => {
    expect(resolveAmountLimits({ amount: 0, method, rate: 1.1583 }).belowMin).toBe(false);
  });
});

describe('formatUsdcBound', () => {
  it('rounds a minimum up and a maximum down, into the accepted range', () => {
    // 18.9873 rounded down to 18.98 would be re-rejected as still below the
    // minimum; 18.99 clears it.
    expect(formatUsdcBound(18.9873, 'up')).toBe('18.99');
    expect(formatUsdcBound(74550.317, 'down')).toBe('74,550.31');
  });
});
