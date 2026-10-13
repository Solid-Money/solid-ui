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

/**
 * Interest added over the last `days` days, in USD.
 *
 * A product's N-day APY is its share price's growth over those N days, annualised, so the
 * growth itself can be read back out of it. That is exact for a balance held through the
 * whole window. Money that arrived inside the window earned less, so the result is never
 * more than what was earned since the first deposit, when that is known.
 */
export const interestOverPastDays = (
  valueUsd: number,
  apyPercent: number | undefined,
  days = 30,
  earnedSinceStart?: number,
) => {
  if (
    !(valueUsd > 0) ||
    apyPercent === undefined ||
    !Number.isFinite(apyPercent) ||
    apyPercent <= 0
  )
    return 0;
  const growth = Math.pow(1 + apyPercent / 100, days / 365) - 1;
  const interest = (valueUsd * growth) / (1 + growth);
  return earnedSinceStart === undefined
    ? interest
    : Math.min(interest, Math.max(earnedSinceStart, 0));
};
