import { getBuyFuseTierTargets } from '@/lib/buyFuseTiers';
import { RewardsTier } from '@/lib/types';

import type { FuseSkipLine } from '@/lib/types';

const FALLBACK_NEXT_TIER: Record<RewardsTier, RewardsTier | null> = {
  [RewardsTier.CORE]: RewardsTier.PRIME,
  [RewardsTier.PRIME]: RewardsTier.ULTRA,
  [RewardsTier.ULTRA]: null,
};

const FALLBACK_TIER_POINT_THRESHOLDS: Partial<Record<RewardsTier, number>> = {
  [RewardsTier.PRIME]: 5_000_000,
  [RewardsTier.ULTRA]: 35_000_000,
};

/**
 * Whether the "Skip the line" section has anything to show.
 *
 * Three separate things can each mean "no section": an older backend that
 * doesn't send the block at all, the admin kill-switch being off, and a config
 * with no rungs priced. All of them collapse to the same outcome, so the check
 * lives here rather than being re-derived at each call site.
 */
export const hasSkipTheLine = (skipLine?: FuseSkipLine): skipLine is FuseSkipLine =>
  Boolean(skipLine?.enabled && skipLine.tiers.length > 0);

interface ResolveTierUpgradeCardDataParams {
  currentTier: RewardsTier;
  nextTier?: RewardsTier | null;
  targetPoints?: number;
  skipLine?: FuseSkipLine;
  allowFallback: boolean;
}

/**
 * Resolve the data needed by the combined points/FUSE upgrade card.
 *
 * QA and preview builds keep a launch-threshold fallback so a failed rewards
 * request or an older response cannot remove the card during review. An
 * explicit backend kill-switch is still authoritative, and production never
 * invents an upgrade offer when the block is absent.
 */
export const resolveTierUpgradeCardData = ({
  currentTier,
  nextTier,
  targetPoints,
  skipLine,
  allowFallback,
}: ResolveTierUpgradeCardDataParams) => {
  const useFallback = allowFallback && skipLine === undefined;
  const resolvedNextTier =
    nextTier === undefined && useFallback ? FALLBACK_NEXT_TIER[currentTier] : (nextTier ?? null);
  const resolvedSkipLine =
    skipLine ??
    (useFallback
      ? {
          enabled: true,
          balanceFuse: 0,
          balanceUsd: 0,
          unlockedTier: currentTier,
          tiers: getBuyFuseTierTargets(currentTier),
        }
      : undefined);
  const resolvedTargetPoints =
    targetPoints && targetPoints > 0
      ? targetPoints
      : useFallback && resolvedNextTier
        ? (FALLBACK_TIER_POINT_THRESHOLDS[resolvedNextTier] ?? 0)
        : 0;
  const showTierUpgradeCard = Boolean(
    hasSkipTheLine(resolvedSkipLine) &&
    resolvedNextTier !== null &&
    resolvedSkipLine.tiers.some(rung => rung.tier === resolvedNextTier),
  );

  return {
    nextTier: resolvedNextTier,
    targetPoints: resolvedTargetPoints,
    skipLine: resolvedSkipLine,
    showTierUpgradeCard,
  };
};
