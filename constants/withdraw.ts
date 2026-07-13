/** Token symbols that can be withdrawn from vaults (soUSD, soFUSE, fusdc). */
export const SOLID_TOKEN_SYMBOLS = ['sousd', 'sofuse', 'fusdc', 'soeth'] as const;

export type SolidTokenSymbol = (typeof SOLID_TOKEN_SYMBOLS)[number];

export function isSolidTokenSymbol(symbol: string | undefined): boolean {
  if (!symbol) return false;
  return (SOLID_TOKEN_SYMBOLS as readonly string[]).includes(symbol.toLowerCase());
}

/**
 * A savings "vault" groups the withdrawable tokens by their underlying asset,
 * independent of the network they sit on. soUSD and fUSDC both belong to the
 * USD vault; soFUSE and soETH have their own vaults.
 */
export type VaultKey = 'USD' | 'FUSE' | 'ETH';

export interface VaultMeta {
  key: VaultKey;
  /** Name shown in the vault selection screen (no network). */
  displayName: string;
  /** Symbol passed to getTokenIcon for the vault icon. */
  iconSymbol: string;
  /** Asset the user ultimately receives when withdrawing. */
  destinationSymbol: string;
  /**
   * Whether reaching the destination requires bridging Fuse -> Ethereum first
   * (a 2-step flow). soFUSE withdraws directly on Fuse in a single step.
   */
  requiresBridge: boolean;
}

export const VAULT_META: Record<VaultKey, VaultMeta> = {
  USD: {
    key: 'USD',
    displayName: 'soUSD',
    iconSymbol: 'soUSD',
    destinationSymbol: 'USDC',
    requiresBridge: true,
  },
  ETH: {
    key: 'ETH',
    displayName: 'soETH',
    iconSymbol: 'soETH',
    destinationSymbol: 'WETH',
    requiresBridge: true,
  },
  FUSE: {
    key: 'FUSE',
    displayName: 'soFUSE',
    iconSymbol: 'soFUSE',
    destinationSymbol: 'FUSE',
    requiresBridge: false,
  },
};

/** Maps a token symbol to the vault it belongs to (null if not a vault token). */
export function getVaultKey(symbol: string | undefined): VaultKey | null {
  if (!symbol) return null;
  const s = symbol.toLowerCase();
  if (s === 'sousd' || s === 'fusdc') return 'USD';
  if (s === 'sofuse') return 'FUSE';
  if (s === 'soeth') return 'ETH';
  return null;
}
