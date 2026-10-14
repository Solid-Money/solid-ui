import { VaultType } from '@/lib/types';
import { USD_VAULT_TYPES } from '@/lib/vaultCurrency';

export type VaultAmounts = Record<VaultType, number>;
/** Per-vault APY, `undefined` for a vault with no rate to show (soEURC before it earns). */
export type VaultApys = Record<VaultType, number | undefined>;
/** Per-vault USD values. soEURC is held in EUR, so it has no entry to add. */
export type UsdVaultAmounts = Partial<VaultAmounts>;

/** `4.5% APY`, or `— APY` for a vault with no rate yet — never an invented 0%. */
export const formatVaultApyLabel = (apy: number | undefined) =>
  apy === undefined ? '— APY' : `${apy.toFixed(1)}% APY`;

/**
 * Shown when the analytics API reports no yield for a vault, so a vault card
 * never renders a 0% headline while upstream metrics are missing or zeroed.
 * These are indicative rates, not measured ones — keep them in step with the
 * rates the vaults are actually expected to return.
 *
 * soEURC has none: it does not earn yet, so it shows "—" rather than a rate it
 * has never paid.
 */
export const FALLBACK_VAULT_APY: VaultApys = {
  [VaultType.USDC]: 4,
  [VaultType.ETH]: 2,
  [VaultType.FUSE]: 14,
  [VaultType.EUR]: undefined,
};

/** The reported APY when there is one, otherwise the vault's indicative rate (if it has one). */
export const resolveVaultApy = (vaultType: VaultType, apy: number | undefined) =>
  apy && apy > 0 ? apy : FALLBACK_VAULT_APY[vaultType];

/**
 * Estimated interest generated in one day at each vault's current APY, in USD.
 * The estimate is deliberately derived per vault so mixed-asset portfolios
 * are weighted by their actual USD value rather than a blended headline rate.
 *
 * USD-valued vaults only: soEURC is held in EUR and never enters a dollar figure.
 */
export const calculateEstimatedDailyEarnings = (
  valuesByVault: UsdVaultAmounts,
  apyByVault: Partial<VaultApys>,
) =>
  USD_VAULT_TYPES.reduce(
    (total, vaultType) =>
      total +
      (Math.max(valuesByVault[vaultType] ?? 0, 0) * Math.max(apyByVault[vaultType] ?? 0, 0)) /
        100 /
        365,
    0,
  );
