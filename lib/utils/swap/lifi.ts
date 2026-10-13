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

/** The whole cost of the swap in USD: everything in minus everything out. */
export function lifiTotalCostUsd(quote: LifiSwapQuote): number | undefined {
  if (!quote.fromAmountUsd || !quote.toAmountUsd) return undefined;
  const onTop = sumFeesUsd(quote.fees.filter(fee => !fee.included));
  return Math.max(0, usd(quote.fromAmountUsd) - usd(quote.toAmountUsd)) + onTop;
}

export function formatEta(seconds: number): string {
  if (seconds < 60) return `~${Math.max(1, Math.round(seconds))} sec`;
  const minutes = Math.round(seconds / 60);
  return minutes < 60 ? `~${minutes} min` : `~${Math.round(minutes / 60)} h`;
}

export const formatUsd = (value: number) =>
  value > 0 && value < 0.01 ? '<$0.01' : `$${value.toFixed(2)}`;
