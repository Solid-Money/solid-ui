import { TRANSFI_ERROR_CODE, TransfiError } from '@/lib/transfiErrors';

import type { TransfiCashoutLimits } from '@/lib/types';

/**
 * Whether a cash-out amount can go ahead, checked on the keystroke against the
 * balance and TransFi's limits for the selected payout method.
 *
 * TransFi states cash-out limits in the USDC sent (its own refusals read
 * "26.256445 USDCBASE to 100019.160769 USDCBASE"), so they compare straight
 * against what is typed. Everything is compared in the token's smallest units:
 * a float comparison would let 26.256444 through a 26.256445 minimum.
 */

/** The limits in token units: the minimum rounded up, the maximum down. */
export interface CashoutLimitUnits {
  min: bigint;
  max: bigint;
}

export type CashoutAmountProblemKind =
  | 'balance_below_min'
  | 'over_balance'
  | 'above_max'
  | 'below_min';

export interface CashoutAmountProblem {
  kind: CashoutAmountProblemKind;
  message: string;
}

/** Problems that are about TransFi's limits, as opposed to the user's balance. */
export const isLimitProblem = (problem?: CashoutAmountProblem): boolean =>
  problem?.kind === 'balance_below_min' ||
  problem?.kind === 'above_max' ||
  problem?.kind === 'below_min';

/**
 * A limit in token units. Precision past the token's is rounded into the
 * accepted range — a minimum up, a maximum down — so nothing that passes here
 * is refused for a fraction TransFi can see and the wallet can't send.
 */
export const toTokenUnits = (value: number, decimals: number, round: 'up' | 'down'): bigint => {
  // String() is the shortest exact form (26.256445, not 26.25644499…); toFixed
  // only for the tiny values String() writes with an exponent.
  const text = value < 1e-6 ? value.toFixed(20) : String(value);
  const [whole, fraction = ''] = text.split('.');
  const kept = BigInt(whole + fraction.slice(0, decimals).padEnd(decimals, '0'));
  const dropped = /[1-9]/.test(fraction.slice(decimals));
  return round === 'up' && dropped ? kept + 1n : kept;
};

export const toLimitUnits = (
  limits: TransfiCashoutLimits,
  decimals: number,
): CashoutLimitUnits => ({
  min: toTokenUnits(limits.minLimit, decimals, 'up'),
  max: toTokenUnits(limits.maxLimit, decimals, 'down'),
});

/**
 * A limit shown to two decimals, rounded into the accepted range: 26.256445 is
 * "26.26", because "26.25" would be refused again when typed back in.
 */
export const formatLimit = (units: bigint, decimals: number, round: 'up' | 'down'): string => {
  const step = 10n ** BigInt(Math.max(decimals - 2, 0));
  const remainder = units % step;
  const cents = units / step + (round === 'up' && remainder !== 0n ? 1n : 0n);
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(Number(cents) / 100);
};

/**
 * The first thing wrong with the amount, in the order the screen reports them:
 * a balance that can't reach the minimum at all, then the balance, then the
 * maximum, then the minimum. Without limits only the balance is checked — the
 * server checks the limits again before the order either way.
 *
 * `amountWei` is undefined while the box is empty or not yet a number; the
 * balance check is skipped while `balanceWei` is still loading.
 */
export const validateCashoutAmount = ({
  amountWei,
  balanceWei,
  limits,
  decimals,
}: {
  amountWei?: bigint;
  balanceWei?: bigint;
  limits?: CashoutLimitUnits;
  decimals: number;
}): CashoutAmountProblem | undefined => {
  if (limits && balanceWei != null && balanceWei < limits.min) {
    return {
      kind: 'balance_below_min',
      message: `You need at least ${formatLimit(limits.min, decimals, 'up')} USDC to cash out`,
    };
  }
  if (amountWei == null || amountWei <= 0n) return undefined;
  if (balanceWei != null && amountWei > balanceWei) {
    return { kind: 'over_balance', message: 'That’s more than your balance' };
  }
  if (limits && amountWei > limits.max) {
    return {
      kind: 'above_max',
      message: `The maximum cash-out is ${formatLimit(limits.max, decimals, 'down')} USDC`,
    };
  }
  if (limits && amountWei < limits.min) {
    return {
      kind: 'below_min',
      message: `The minimum cash-out is ${formatLimit(limits.min, decimals, 'up')} USDC`,
    };
  }
  return undefined;
};

/** What Max fills: the balance, capped at the maximum cash-out. */
export const maxCashoutWei = (balanceWei: bigint, limits?: CashoutLimitUnits): bigint =>
  limits && limits.max < balanceWei ? limits.max : balanceWei;

/**
 * The limits behind a cash-out the server refused as out of range — either
 * a quote or the order-time check. Only our own cash-out code carries USDC
 * limits; TransFi's raw refusal may state them in another unit.
 */
export const limitsFromError = (error: unknown): TransfiCashoutLimits | undefined => {
  if (!(error instanceof TransfiError)) return undefined;
  if (error.code !== TRANSFI_ERROR_CODE.CASHOUT_AMOUNT_OUT_OF_LIMITS) return undefined;
  const { minLimit, maxLimit } = error.details;
  return minLimit != null && maxLimit != null ? { minLimit, maxLimit } : undefined;
};
