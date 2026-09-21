import { VaultType } from '@/lib/types';

export type VaultAmounts = Record<VaultType, number>;

export const formatVaultApyLabel = (apy: number) => `${apy.toFixed(1)}% APY`;

/**
 * Shown when the analytics API reports no yield for a vault, so a vault card
 * never renders a 0% headline while upstream metrics are missing or zeroed.
 * These are indicative rates, not measured ones — keep them in step with the
 * rates the vaults are actually expected to return.
 */
export const FALLBACK_VAULT_APY: VaultAmounts = {
  [VaultType.USDC]: 4,
  [VaultType.ETH]: 2,
  [VaultType.FUSE]: 14,
};

/** The reported APY when there is one, otherwise the vault's indicative rate. */
export const resolveVaultApy = (vaultType: VaultType, apy: number | undefined) =>
  apy && apy > 0 ? apy : FALLBACK_VAULT_APY[vaultType];

/**
 * Estimated interest generated in one day at each vault's current APY.
 * The estimate is deliberately derived per vault so mixed-asset portfolios
 * are weighted by their actual USD value rather than a blended headline rate.
 */
export const calculateEstimatedDailyEarnings = (
  valuesByVault: VaultAmounts,
  apyByVault: VaultAmounts,
) =>
  Object.values(VaultType).reduce(
    (total, vaultType) =>
      total +
      (Math.max(valuesByVault[vaultType] ?? 0, 0) * Math.max(apyByVault[vaultType] ?? 0, 0)) /
        100 /
        365,
    0,
  );
