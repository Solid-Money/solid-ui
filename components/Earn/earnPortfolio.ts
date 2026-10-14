import { type PortfolioAsset, sumKnownValues } from '@/lib/portfolio';
import { VaultType } from '@/lib/types';
import { getEarningTokenVault } from '@/lib/vaults';

import { YIELD_PRODUCT_ORDER } from './yieldProducts';

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

/** What the portfolio holds of one product (USD / ETH / FUSE Yield), wherever its shares are. */
export type YieldHolding = {
  type: VaultType;
  /** Undefined when none of it can be valued. */
  valueUsd: number | undefined;
  /** soUSD / soETH / soFUSE on every network, including shares backing the card. */
  shareAmount: number;
  /**
   * The part held as shares the savings reads don't cover: a production share seen from a
   * development build lands among the wallet's coins instead.
   */
  unreadUsd: number;
  apy: number | undefined;
};

type EarnPart = {
  vault: { type: VaultType };
  valueUsd: number | undefined;
  shareAmount?: number;
  apy?: number;
};
type CashPart = Pick<PortfolioAsset, 'valueUsd' | 'balance' | 'tokens'>;

/** A coin that is really a product's share (soUSD is USD Yield), so it isn't listed as a coin. */
export const isYieldShare = (asset: Pick<PortfolioAsset, 'tokens'>) =>
  !!getEarningTokenVault(asset.tokens[0]);

/** Each product's holding, in Earn's order, counting every share once. */
export const yieldHoldings = (earnAssets: EarnPart[], cashAssets: CashPart[]): YieldHolding[] =>
  YIELD_PRODUCT_ORDER.map(type => {
    const earn = earnAssets.find(asset => asset.vault.type === type);
    const shares = cashAssets.filter(
      asset => getEarningTokenVault(asset.tokens[0])?.vault.type === type,
    );
    return {
      type,
      valueUsd: sumKnownValues([
        (earn?.valueUsd ?? 0) > 0 ? earn?.valueUsd : 0,
        ...shares.map(asset => asset.valueUsd),
      ]).total,
      shareAmount: (earn?.shareAmount ?? 0) + shares.reduce((sum, asset) => sum + asset.balance, 0),
      unreadUsd: sumKnownValues(shares.map(asset => asset.valueUsd)).total ?? 0,
      apy: earn?.apy,
    };
  });

/** The rate across holdings, each weighted by what it is worth. */
export const weightedApy = (holdings: { valueUsd: number | undefined; apy: number }[]) => {
  const valued = holdings.filter(item => (item.valueUsd ?? 0) > 0);
  const total = valued.reduce((sum, item) => sum + (item.valueUsd ?? 0), 0);
  return total > 0
    ? valued.reduce((sum, item) => sum + (item.valueUsd ?? 0) * item.apy, 0) / total
    : 0;
};
