export const STABLECOIN_SYMBOLS = ['usdc', 'usdt'] as const;

export function isStablecoinSymbol(symbol: string | undefined): boolean {
  if (!symbol) return false;
  return STABLECOIN_SYMBOLS.includes(symbol.toLowerCase() as (typeof STABLECOIN_SYMBOLS)[number]);
}
