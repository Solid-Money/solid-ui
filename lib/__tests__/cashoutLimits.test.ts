/// <reference types="jest" />

import { parseUnits } from 'viem';

import {
  formatLimit,
  isLimitProblem,
  limitsFromError,
  maxCashoutWei,
  readCashoutLimits,
  toLimitUnits,
  toTokenUnits,
  validateCashoutAmount,
} from '@/lib/cashoutLimits';
import { TRANSFI_ERROR_CODE, TransfiError } from '@/lib/transfiErrors';

const DECIMALS = 6;
const usdc = (amount: string) => parseUnits(amount, DECIMALS);

/** As TransFi states a cash-out's limits: in USDC, to six decimals. */
const LIMITS = toLimitUnits({ minLimit: 26.256445, maxLimit: 100019.160769 }, DECIMALS);

const validate = (amount: string | undefined, balance = '200000') =>
  validateCashoutAmount({
    amountWei: amount === undefined ? undefined : usdc(amount),
    balanceWei: usdc(balance),
    limits: LIMITS,
    decimals: DECIMALS,
  });

describe('validateCashoutAmount', () => {
  it.each([
    ['below the minimum', '26.256444', 'below_min', 'The minimum cash-out is 26.26 USDC'],
    ['exactly the minimum', '26.256445', undefined, undefined],
    ['between the limits', '500', undefined, undefined],
    ['exactly the maximum', '100019.160769', undefined, undefined],
    ['above the maximum', '100019.16077', 'above_max', 'The maximum cash-out is 100,019.16 USDC'],
  ])('%s', (_label, amount, kind, message) => {
    expect(validate(amount)).toEqual(kind ? { kind, message } : undefined);
  });

  it('says an amount over the balance is over the balance', () => {
    expect(validate('600', '500')).toEqual({
      kind: 'over_balance',
      message: 'That’s more than your balance',
    });
  });

  it('says a balance under the minimum before anything is typed', () => {
    expect(validate(undefined, '20')).toEqual({
      kind: 'balance_below_min',
      message: 'You need at least 26.26 USDC to cash out',
    });
  });

  describe('reports the first failing check, in order', () => {
    it('balance below the minimum, over everything else', () => {
      // Also over the balance and below the minimum: neither is the real story.
      expect(validate('25', '20')?.kind).toBe('balance_below_min');
    });

    it('over the balance, over the maximum', () => {
      expect(validate('150000', '120000')?.kind).toBe('over_balance');
    });

    it('the maximum, over the minimum', () => {
      // Only an inverted pair can fail both; the order still decides.
      const inverted = { min: usdc('60'), max: usdc('40') };
      expect(
        validateCashoutAmount({
          amountWei: usdc('50'),
          balanceWei: usdc('100'),
          limits: inverted,
          decimals: DECIMALS,
        })?.kind,
      ).toBe('above_max');
    });
  });

  it('checks only the balance when the limits are unavailable', () => {
    const check = (amount: string) =>
      validateCashoutAmount({
        amountWei: usdc(amount),
        balanceWei: usdc('500'),
        decimals: DECIMALS,
      });
    expect(check('1')).toBeUndefined();
    expect(check('600')?.kind).toBe('over_balance');
  });

  it('skips the balance while it is still loading', () => {
    expect(
      validateCashoutAmount({ amountWei: usdc('600'), limits: LIMITS, decimals: DECIMALS }),
    ).toBeUndefined();
  });

  it('does not call an empty box too small', () => {
    expect(validate(undefined)).toBeUndefined();
    expect(validate('0')).toBeUndefined();
  });

  it('accepts the rounded numbers it shows', () => {
    // The point of rounding into the range: typing what the message says works.
    expect(validate('26.26')).toBeUndefined();
    expect(validate('100019.16')).toBeUndefined();
  });
});

describe('isLimitProblem', () => {
  it('is true for the limits, not the balance', () => {
    expect(isLimitProblem(validate('1'))).toBe(true);
    expect(isLimitProblem(validate('200000'))).toBe(true);
    expect(isLimitProblem(validate(undefined, '1'))).toBe(true);
    expect(isLimitProblem(validate('600', '500'))).toBe(false);
    expect(isLimitProblem(undefined)).toBe(false);
  });
});

describe('rounding', () => {
  it('shows a minimum rounded up and a maximum rounded down, to two decimals', () => {
    expect(formatLimit(usdc('26.256445'), DECIMALS, 'up')).toBe('26.26');
    expect(formatLimit(usdc('26.256445'), DECIMALS, 'down')).toBe('26.25');
    expect(formatLimit(usdc('100019.160769'), DECIMALS, 'down')).toBe('100,019.16');
    expect(formatLimit(usdc('100019.160769'), DECIMALS, 'up')).toBe('100,019.17');
  });

  it('leaves an exact value alone either way', () => {
    // 1.13 * 100 is 112.99999999999999 in floating point; units have no such drift.
    expect(formatLimit(usdc('1.13'), DECIMALS, 'up')).toBe('1.13');
    expect(formatLimit(usdc('1.13'), DECIMALS, 'down')).toBe('1.13');
    expect(formatLimit(usdc('25'), DECIMALS, 'up')).toBe('25');
  });

  it('turns a limit into exact token units', () => {
    expect(toTokenUnits(26.256445, DECIMALS, 'up')).toBe(26_256_445n);
    expect(toTokenUnits(100019.160769, DECIMALS, 'down')).toBe(100_019_160_769n);
  });

  it('rounds precision past the token’s into the accepted range', () => {
    // 10.0000001 can't be sent; the smallest amount that clears it is 10.000001.
    expect(toTokenUnits(10.0000001, DECIMALS, 'up')).toBe(10_000_001n);
    expect(toTokenUnits(20.0000009, DECIMALS, 'down')).toBe(20_000_000n);
  });
});

describe('maxCashoutWei', () => {
  it('fills the maximum when the balance is above it', () => {
    expect(maxCashoutWei(usdc('150000'), LIMITS)).toBe(usdc('100019.160769'));
  });

  it('fills the balance when it is below the maximum', () => {
    expect(maxCashoutWei(usdc('500'), LIMITS)).toBe(usdc('500'));
  });

  it('fills the balance when there are no limits', () => {
    expect(maxCashoutWei(usdc('150000'))).toBe(usdc('150000'));
  });
});

describe('readCashoutLimits', () => {
  it('passes usable limits through', () => {
    expect(readCashoutLimits({ minLimit: 26.256445, maxLimit: 100019.160769 })).toEqual({
      minLimit: 26.256445,
      maxLimit: 100019.160769,
    });
  });

  it.each([
    ['no body', null],
    ['a missing limit', { minLimit: 26.256445 }],
    ['a null limit', { minLimit: null, maxLimit: 100 }],
    ['a limit sent as a string', { minLimit: '26.25', maxLimit: 100 }],
    ['an inverted pair', { minLimit: 100, maxLimit: 10 }],
    ['a negative limit', { minLimit: -1, maxLimit: 10 }],
  ])('rejects %s', (_label, body) => {
    expect(readCashoutLimits(body)).toBeUndefined();
  });
});

describe('limitsFromError', () => {
  it('reads the limits off a cash-out refused as out of range', () => {
    const error = new TransfiError(
      TRANSFI_ERROR_CODE.CASHOUT_AMOUNT_OUT_OF_LIMITS,
      'adjust_amount',
      'The minimum cash-out is 26.26 USDC',
      400,
      { minLimit: 26.256445, maxLimit: 100019.160769 },
    );
    expect(limitsFromError(error)).toEqual({ minLimit: 26.256445, maxLimit: 100019.160769 });
  });

  it('ignores limits it cannot vouch for the unit of', () => {
    // A buy-crypto refusal carries fiat limits under the same field names.
    const error = new TransfiError('QUOTES_LIMIT_ERROR', 'adjust_amount', 'outside', 400, {
      minLimit: 23,
      maxLimit: 89302.98,
      fiatCurrency: 'EUR',
    });
    expect(limitsFromError(error)).toBeUndefined();
    expect(limitsFromError(new Error('offline'))).toBeUndefined();
  });
});
