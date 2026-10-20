import { VAULTS } from '@/constants/vaults';
import { Vault, VaultType } from '@/lib/types';
import { getVaultCurrencySymbol } from '@/lib/vaultCurrency';

/**
 * Earn's USD-valued products in the order the app lists them: dollars first. EUR Yield
 * (soEURC) is held in euros and listed after them, apart from every dollar total.
 */
export const YIELD_PRODUCT_ORDER = [VaultType.USDC, VaultType.ETH, VaultType.FUSE] as const;

export const yieldVault = (type: VaultType): Vault =>
  VAULTS.find(vault => vault.type === type) ?? VAULTS[0];

/** "USD Yield", "ETH Yield", "FUSE Yield", "EUR Yield". The share token is never the product's name. */
export const yieldProductName = (type: VaultType) => yieldVault(type).vaultName ?? type;

/** What a user puts in, for a product they have not funded yet. */
export const YIELD_DEPOSIT_ASSETS: Record<VaultType, string> = {
  [VaultType.USDC]: 'USDC, USDT',
  [VaultType.ETH]: 'ETH',
  [VaultType.FUSE]: 'FUSE',
  [VaultType.EUR]: 'EURC',
};

/** What the deposit is worth in, for the no-funds headline: "On your dollars." */
export const YIELD_ASSET_NOUN: Record<VaultType, string> = {
  [VaultType.USDC]: 'dollars',
  [VaultType.ETH]: 'ETH',
  [VaultType.FUSE]: 'FUSE',
  [VaultType.EUR]: 'euros',
};

export const openYieldProduct = (type: VaultType) =>
  ({ pathname: '/savings', params: { vault: type } }) as const;

/** The share token's exchange rate, in what the product is worth in. */
export const formatShareRate = (type: VaultType, rate: number | undefined) => {
  if (rate === undefined || !Number.isFinite(rate) || rate <= 0) return undefined;
  const token = yieldVault(type).vaultToken;
  if (type === VaultType.USDC) return `1 ${token} = $${rate.toFixed(4)}`;
  const underlying = type === VaultType.ETH ? 'ETH' : type === VaultType.EUR ? 'EURC' : 'FUSE';
  return `1 ${token} = ${rate.toFixed(4)} ${underlying}`;
};

/**
 * A product's amount in its own currency, always to the cent ("$0.10", never "$0.1"),
 * "<$0.01" for dust, "—" when unknown — euros ("€0.10") for EUR Yield, dollars otherwise.
 * The shared balance formatter drops trailing zeros under a dollar, which reads wrong next to
 * interest figures that are routinely a few cents.
 */
export const formatYieldAmount = (value: number | undefined, type: VaultType) => {
  if (value === undefined || !Number.isFinite(value)) return '—';
  const symbol = getVaultCurrencySymbol(type);
  const abs = Math.abs(value);
  if (abs > 0 && abs < 0.01) return `${value < 0 ? '−' : ''}<${symbol}0.01`;
  return `${value < 0 ? '−' : ''}${symbol}${abs.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

/** {@link formatYieldAmount} in dollars, for every figure that is a USD one. */
export const formatYieldUsd = (value: number | undefined) =>
  formatYieldAmount(value, VaultType.USDC);
