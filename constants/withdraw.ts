/** Token symbols that can be withdrawn from vaults (soUSD, soFUSE, fusdc). */
export const SOLID_TOKEN_SYMBOLS = ['sousd', 'sofuse', 'fusdc'] as const;

export type SolidTokenSymbol = (typeof SOLID_TOKEN_SYMBOLS)[number];

export function isSolidTokenSymbol(symbol: string | undefined): boolean {
  if (!symbol) return false;
  return (SOLID_TOKEN_SYMBOLS as readonly string[]).includes(symbol.toLowerCase());
}
