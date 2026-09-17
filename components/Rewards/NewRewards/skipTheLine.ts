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
 * The FUSE thresholds at launch, for the preview fallback only.
 *
 * `getBuyFuseTierTargets` prices its rungs from the backend's own block, which
 * is exactly what the fallback exists because it does not have — so the
 * fallback has to hand it a stand-in rather than call it with nothing and get
 * an empty list back. These match the shipped `fuse_staking.tier*.amount`
 * defaults; real config always wins when the backend sends it.
 */
const FALLBACK_SKIP_LINE: FuseSkipLine = {
  enabled: true,
  balanceFuse: 0,
  balanceUsd: 0,
  unlockedTier: RewardsTier.CORE,
  tiers: [
    {
      tier: RewardsTier.PRIME,
      requiredFuse: 50_000,
      unlocked: false,
      remainingFuse: 50_000,
      progressPct: 0,
    },
    {
      tier: RewardsTier.ULTRA,
      requiredFuse: 400_000,
      unlocked: false,
      remainingFuse: 400_000,
      progressPct: 0,
    },
  ],
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
          tiers: getBuyFuseTierTargets(currentTier, FALLBACK_SKIP_LINE),
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
