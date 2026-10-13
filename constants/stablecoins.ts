export const STABLECOIN_SYMBOLS = ['usdc', 'usdt'] as const;

export function isStablecoinSymbol(symbol: string | undefined): boolean {
  if (!symbol) return false;
  return STABLECOIN_SYMBOLS.includes(symbol.toLowerCase() as (typeof STABLECOIN_SYMBOLS)[number]);
}

/**
 * Stablecoins as the Assets screen groups them: fiat-pegged tokens, bridged variants included.
 * Display only — deposit fees keep the narrower STABLECOIN_SYMBOLS above.
 */
const DISPLAY_STABLECOIN_SYMBOLS = new Set([
  'USDC',
  'USDC.E',
  'USDBC',
  'USDT',
  'USDT.E',
  'USDT0',
  'USD₮',
  'USD₮0',
  'EURC',
  'EURE',
  'EURS',
  'DAI',
  'USDS',
  'PYUSD',
  'GHO',
  'FRAX',
  'LUSD',
  'CRVUSD',
  'USDP',
  'TUSD',
  'FDUSD',
  'RLUSD',
  'USDE',
]);

export const isDisplayStablecoin = (symbol: string | undefined): boolean =>
  !!symbol && DISPLAY_STABLECOIN_SYMBOLS.has(symbol.toUpperCase());
