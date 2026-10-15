import { Percent } from '@cryptoalgebra/fuse-sdk';

import { LifiSwapFee, LifiSwapQuote } from '@/lib/types/lifi-swap';

const usd = (value: string | null | undefined) => {
  const n = Number(value);
  return value != null && Number.isFinite(n) ? n : 0;
};

export const sumFeesUsd = (fees: LifiSwapFee[]) =>
  fees.reduce((total, fee) => total + usd(fee.amountUsd), 0);

/**
 * What the route costs beyond its stated fees, as LI.FI prices both sides:
 * slippage from DEX pools and bridge spreads. Solid's and LI.FI's own fees are
 * taken out, because the user sees them on their own lines and they are not
 * the market moving against them.
 *
 * Undefined when LI.FI could not price either side; the form then shows no
 * figure and does not warn, rather than blocking on a number it doesn't have.
 */
export function lifiPriceImpact(quote: LifiSwapQuote | undefined): Percent | undefined {
  if (!quote?.fromAmountUsd || !quote.toAmountUsd) return undefined;
  const fromUsd = usd(quote.fromAmountUsd);
  const toUsd = usd(quote.toAmountUsd);
  if (fromUsd <= 0) return undefined;

  const ownFees = sumFeesUsd(quote.fees.filter(fee => fee.kind !== 'provider' && fee.included));
  const impact = (fromUsd - toUsd - ownFees) / fromUsd;
  return new Percent(Math.max(0, Math.round(impact * 10_000)), 10_000);
}

/**
 * The whole cost of the swap in USD: everything in minus everything out, plus
 * the network fee when the user pays it rather than our paymaster.
 */
export function lifiTotalCostUsd(
  quote: LifiSwapQuote,
  { includeGas = false }: { includeGas?: boolean } = {},
): number | undefined {
  if (!quote.fromAmountUsd || !quote.toAmountUsd) return undefined;
  const onTop = sumFeesUsd(quote.fees.filter(fee => !fee.included));
  const gas = includeGas ? lifiGasUsd(quote) : 0;
  return Math.max(0, usd(quote.fromAmountUsd) - usd(quote.toAmountUsd)) + onTop + gas;
}

export function formatEta(seconds: number): string {
  if (seconds < 60) return `~${Math.max(1, Math.round(seconds))} sec`;
  const minutes = Math.round(seconds / 60);
  return minutes < 60 ? `~${minutes} min` : `~${Math.round(minutes / 60)} h`;
}

export const formatUsd = (value: number) =>
  value > 0 && value < 0.01 ? '<$0.01' : `$${value.toFixed(2)}`;

/** LI.FI's estimate of the source chain's network fee, in USD. */
export const lifiGasUsd = (quote: LifiSwapQuote) =>
  quote.gasCosts.reduce((total, gas) => total + usd(gas.amountUsd), 0);

export interface UserOperationGas {
  callGasLimit: bigint;
  verificationGasLimit: bigint;
  preVerificationGas: bigint;
  paymasterVerificationGasLimit?: bigint;
  paymasterPostOpGasLimit?: bigint;
  maxFeePerGas: bigint;
}

/**
 * What the EntryPoint (v0.7) takes from an unsponsored account before running
 * its operation: every gas limit at the max fee. The unused part is refunded
 * afterwards, but the account has to hold all of it, on top of whatever its
 * calls send, when the operation is validated.
 */
export const userOperationPrefund = (op: UserOperationGas): bigint =>
  (op.callGasLimit +
    op.verificationGasLimit +
    op.preVerificationGas +
    (op.paymasterVerificationGasLimit ?? 0n) +
    (op.paymasterPostOpGasLimit ?? 0n)) *
  op.maxFeePerGas;
