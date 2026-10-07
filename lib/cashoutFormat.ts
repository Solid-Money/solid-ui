import type { TransfiCashoutQuote } from '@/lib/types';

export const formatCashoutFiat = (value: number | undefined, currency: string): string =>
  value == null
    ? 'Not available'
    : `${new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(value)} ${currency}`;

/**
 * "1 USDC ≈ 0.93 EUR", worked out from the quote's own amounts rather than its
 * `exchangeRate`: TransFi's offramp examples quote that rate in both directions
 * (fiat per USDC in one, USDC per fiat in another), and the amounts are not
 * ambiguous. Fees are in fiat and come off the payout, so they are added back.
 */
export const formatCashoutRate = (quote: TransfiCashoutQuote, currency: string): string => {
  const usdc = Number(quote.usdcAmount);
  if (!usdc || quote.fiatAmount == null) return 'Not available';
  const fiatPerUsdc = (quote.fiatAmount + (quote.totalFee ?? 0)) / usdc;
  return `1 USDC ≈ ${new Intl.NumberFormat(undefined, { maximumFractionDigits: 4 }).format(
    fiatPerUsdc,
  )} ${currency}`;
};
