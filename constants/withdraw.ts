/** Token symbols that can be withdrawn from vaults (soUSD/soUSDC, soFUSE, fUSDC, soETH, soEURC). */
export const SOLID_TOKEN_SYMBOLS = [
  'sousd',
  'sousdc',
  'sofuse',
  'fusdc',
  'soeth',
  'soeurc',
  // The same share's on-chain symbol on the Base deployments from Oct 15 2026 on.
  'soeur',
] as const;

export type SolidTokenSymbol = (typeof SOLID_TOKEN_SYMBOLS)[number];

export function isSolidTokenSymbol(symbol: string | undefined): boolean {
  if (!symbol) return false;
  return (SOLID_TOKEN_SYMBOLS as readonly string[]).includes(symbol.toLowerCase());
}

/**
 * A savings "vault" groups the withdrawable tokens by their underlying asset,
 * independent of the network they sit on. soUSD and fUSDC both belong to the
 * USD vault; soFUSE, soETH and soEURC have their own vaults.
 */
export type VaultKey = 'USD' | 'FUSE' | 'ETH' | 'EUR';

export interface VaultMeta {
  key: VaultKey;
  /** Name shown in the vault selection screen (no network). */
  displayName: string;
  /** Symbol passed to getTokenIcon for the vault icon. */
  iconSymbol: string;
  /** Asset the user ultimately receives when withdrawing. */
  destinationSymbol: string;
  /** Network the destination asset is delivered on, for the "To" row. */
  destinationNetwork: string;
  /**
   * Whether reaching the destination requires bridging off Fuse first (a 2-step
   * flow): to Base or Ethereum for soUSD, Ethereum for soETH. soFUSE withdraws
   * directly on Fuse and soEURC directly on Base, each in a single step.
   */
  requiresBridge: boolean;
}

export const VAULT_META: Record<VaultKey, VaultMeta> = {
  USD: {
    key: 'USD',
    displayName: 'soUSD',
    iconSymbol: 'soUSD',
    destinationSymbol: 'USDC',
    destinationNetwork: 'Ethereum',
    requiresBridge: true,
  },
  ETH: {
    key: 'ETH',
    displayName: 'soETH',
    iconSymbol: 'soETH',
    destinationSymbol: 'WETH',
    destinationNetwork: 'Ethereum',
    requiresBridge: true,
  },
  FUSE: {
    key: 'FUSE',
    displayName: 'soFUSE',
    iconSymbol: 'soFUSE',
    destinationSymbol: 'FUSE',
    destinationNetwork: 'Fuse',
    requiresBridge: false,
  },
  EUR: {
    key: 'EUR',
    displayName: 'soEURC',
    iconSymbol: 'soEURC',
    destinationSymbol: 'EURC',
    destinationNetwork: 'Base',
    requiresBridge: false,
  },
};

/** Maps a token symbol to the vault it belongs to (null if not a vault token). */
export function getVaultKey(symbol: string | undefined): VaultKey | null {
  // Persisted activity rows can be corrupt; never call toLowerCase on a non-string.
  if (typeof symbol !== 'string' || !symbol) return null;
  const s = symbol.toLowerCase();
  if (s === 'sousd' || s === 'sousdc' || s === 'fusdc') return 'USD';
  if (s === 'sofuse') return 'FUSE';
  if (s === 'soeth') return 'ETH';
  if (s === 'soeurc' || s === 'soeur') return 'EUR';
  return null;
}

/**
 * `secondsToDeadline` passed to BoringQueue.requestOnChainWithdraw. The clock
 * starts at maturity, and once it runs out the request can no longer be solved
 * — only cancelled — so this is the window the solver has to fill it.
 */
export const WITHDRAW_SECONDS_TO_DEADLINE = 7 * 24 * 60 * 60; // 7 days
