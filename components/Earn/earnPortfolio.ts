import { VaultType } from '@/lib/types';

export type VaultAmounts = Record<VaultType, number>;

export const formatVaultApyLabel = (apy: number) => `${apy.toFixed(1)}% APY`;

/** Keep vaults visible while APY loads, then hide any vault with no positive yield. */
export const shouldShowEarnVaultCard = (apy: number, isApyLoading: boolean) =>
  isApyLoading || apy > 0;

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
