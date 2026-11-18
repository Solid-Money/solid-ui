import { formatUnits } from 'viem';

export interface TokenUnits {
  raw: bigint;
  decimals: number;
}

/** Sum balances for the same token across chains with different decimals. */
export function sumTokenUnits(amounts: TokenUnits[]): TokenUnits {
  const decimals = amounts.reduce((max, amount) => Math.max(max, amount.decimals), 0);
  const raw = amounts.reduce(
    (total, amount) => total + amount.raw * 10n ** BigInt(decimals - amount.decimals),
    0n,
  );
  return { raw, decimals };
}

/** Round a nonnegative token amount for display without converting it to a number. */
export function formatTokenUnits(
  { raw, decimals }: TokenUnits,
  maximumFractionDigits: number,
  minimumFractionDigits = 0,
): string {
  const shownDecimals = Math.min(decimals, maximumFractionDigits);
  const divisor = 10n ** BigInt(decimals - shownDecimals);
  const rounded = (raw + divisor / 2n) / divisor;
  const [whole, fraction = ''] = formatUnits(rounded, shownDecimals).split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const padded = fraction.padEnd(minimumFractionDigits, '0');
  return padded ? `${grouped}.${padded}` : grouped;
}
