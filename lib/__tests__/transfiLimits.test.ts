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

/**
 * A priced quote: 100 USDC costs 86.46 EUR.
 *
 * `exchangeRate` is TransFi's direction — USDC per unit of fiat — so 1.1583
 * reads "one euro buys 1.1583 USDC", which is why the total is *below* the USDC
 * amount rather than above it.
 */
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
    // 10 USDC ≈ 8.63 EUR, under the 22 EUR floor — caught without a quote.
    const limits = resolveAmountLimits({ amount: 10, method, usdcPerFiat: 1.1583 });

    expect(limits.belowMin).toBe(true);
    expect(limits.aboveMax).toBe(false);
    expect(limits.minUsdc).toBeCloseTo(25.48, 2);
  });

  it('flags an amount above the maximum on the keystroke', () => {
    const limits = resolveAmountLimits({ amount: 150_000, method, usdcPerFiat: 1.1583 });

    expect(limits.aboveMax).toBe(true);
    expect(limits.maxUsdc).toBeCloseTo(100021.08, 2);
  });

  it('accepts an amount inside the range', () => {
    const limits = resolveAmountLimits({
      amount: 100,
      quote: quote(),
      method,
      usdcPerFiat: 1.1583,
    });

    expect(limits).toMatchObject({ belowMin: false, aboveMax: false });
  });

  it('trusts the quoted fiat total over the rate conversion at the ceiling', () => {
    // Fees are in the total but not in the rate: 100,000 USDC clears the
    // converted ceiling of 100,021 and prices at 86,333.42 EUR, but the 22 EUR
    // fee carries the total past the 86,351.62 EUR maximum.
    const limits = resolveAmountLimits({
      amount: 100_000,
      quote: quote({ usdcAmount: '100000', fiatAmount: 86_355.42, totalFee: 22 }),
      method,
      usdcPerFiat: 1.1583,
    });

    expect(limits.aboveMax).toBe(true);
  });

  it('trusts the quoted fiat total at the floor when the stored rate has drifted', () => {
    // The rate is the last one seen for the pair, so it can be minutes old. The
    // quote for this exact amount is the authority: 26 USDC clears the converted
    // floor, but this quote priced it at 21.90 EUR, under the 22 EUR minimum.
    const limits = resolveAmountLimits({
      amount: 26,
      quote: quote({ usdcAmount: '26', fiatAmount: 21.9 }),
      method,
      usdcPerFiat: 1.1583,
    });

    expect(limits.belowMin).toBe(true);
  });

  it('converts a BRL floor into a handful of USDC, not a hundred-odd', () => {
    // The case that exposed the inverted conversion. One real BRL buys 0.196
    // USDC, so a 26 BRL floor is ~5.10 USDC and a 509,931.26 BRL ceiling is
    // ~100,007 USDC. Dividing by the rate instead put the floor at 132.57 USDC
    // — a 27 USDC purchase, costing 138.79 BRL and well clear of the real floor,
    // was told to "enter at least 132.58 USDC" — and pushed the ceiling out to
    // 2.6 million, where it could never fire.
    const usdcPerBrl = 0.19611938571486007;
    const pix: TransfiPaymentMethodOption = {
      paymentCode: 'pix',
      minAmount: 26,
      maxAmount: 509931.26,
    };
    const limits = resolveAmountLimits({
      amount: 27,
      quote: {
        fiatCurrency: 'BRL',
        cryptoCurrency: 'USDC',
        usdcAmount: '27',
        paymentCode: 'pix',
        exchangeRate: usdcPerBrl,
        totalFee: 1.12,
        fiatAmount: 138.79,
        minLimit: 26,
        maxLimit: 509931.26,
      },
      method: pix,
      usdcPerFiat: usdcPerBrl,
    });

    expect(limits.minUsdc).toBeCloseTo(5.1, 2);
    expect(limits.maxUsdc).toBeCloseTo(100007.41, 2);
    expect(limits).toMatchObject({ belowMin: false, aboveMax: false });
  });

  it('still refuses a BRL amount that really is under the floor', () => {
    // 5 USDC is 25.50 BRL — a hair under the 26 BRL minimum.
    const limits = resolveAmountLimits({
      amount: 5,
      method: { paymentCode: 'pix', minAmount: 26, maxAmount: 509931.26 },
      usdcPerFiat: 0.19611938571486007,
    });

    expect(limits.belowMin).toBe(true);
  });

  it('takes the limits from a rejected quote when nothing else has them', () => {
    const limits = resolveAmountLimits({
      amount: 1,
      quoteError: limitFailure(),
      usdcPerFiat: 1.1583,
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
      usdcPerFiat: 1.1583,
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
    expect(resolveAmountLimits({ amount: 0, method, usdcPerFiat: 1.1583 }).belowMin).toBe(false);
  });
});

describe('formatUsdcBound', () => {
  it('rounds a minimum up and a maximum down, into the accepted range', () => {
    // 25.4826 rounded down to 25.48 would be re-rejected as still below the
    // minimum; 25.49 clears it.
    expect(formatUsdcBound(25.4826, 'up')).toBe('25.49');
    expect(formatUsdcBound(100021.081, 'down')).toBe('100,021.08');
  });
});
