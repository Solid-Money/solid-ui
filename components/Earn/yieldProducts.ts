import { VAULTS } from '@/constants/vaults';
import { Vault, VaultType } from '@/lib/types';

/** Earn's products in the order the app lists them: dollars first. */
export const YIELD_PRODUCT_ORDER = [VaultType.USDC, VaultType.ETH, VaultType.FUSE] as const;

export const yieldVault = (type: VaultType): Vault =>
  VAULTS.find(vault => vault.type === type) ?? VAULTS[0];

/** "USD Yield", "ETH Yield", "FUSE Yield". The share token is never the product's name. */
export const yieldProductName = (type: VaultType) => yieldVault(type).vaultName ?? type;

/** What a user puts in, for a product they have not funded yet. */
export const YIELD_DEPOSIT_ASSETS: Record<VaultType, string> = {
  [VaultType.USDC]: 'USDC, USDT',
  [VaultType.ETH]: 'ETH',
  [VaultType.FUSE]: 'FUSE',
};

/** What the deposit is worth in, for the no-funds headline: "On your dollars." */
export const YIELD_ASSET_NOUN: Record<VaultType, string> = {
  [VaultType.USDC]: 'dollars',
  [VaultType.ETH]: 'ETH',
  [VaultType.FUSE]: 'FUSE',
};

export const openYieldProduct = (type: VaultType) =>
  ({ pathname: '/savings', params: { vault: type } }) as const;

/** The share token's exchange rate, in what the product is worth in. */
export const formatShareRate = (type: VaultType, rate: number | undefined) => {
  if (rate === undefined || !Number.isFinite(rate) || rate <= 0) return undefined;
  const token = yieldVault(type).vaultToken;
  return type === VaultType.USDC
    ? `1 ${token} = $${rate.toFixed(4)}`
    : `1 ${token} = ${rate.toFixed(4)} ${type === VaultType.ETH ? 'ETH' : 'FUSE'}`;
};
