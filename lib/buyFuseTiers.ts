import { RewardsTier } from '@/lib/types';

import type { FuseSkipLine, FuseSkipLineTier } from '@/lib/types';

export const BUY_FUSE_TIER_ORDER = [RewardsTier.PRIME, RewardsTier.ULTRA] as const;

const TIER_RANK: Record<RewardsTier, number> = {
  [RewardsTier.CORE]: 0,
  [RewardsTier.PRIME]: 1,
  [RewardsTier.ULTRA]: 2,
};

/** Only the backend's enabled rungs are eligible for an upgrade purchase. */
export const getBuyFuseTierTargets = (
  currentTier: RewardsTier,
  skipLine?: FuseSkipLine,
): FuseSkipLineTier[] => {
  if (!skipLine?.enabled) return [];
  const balanceFuse = Math.max(0, skipLine?.balanceFuse ?? 0);

  return BUY_FUSE_TIER_ORDER.filter(tier => {
    const required = skipLine.tiers.find(candidate => candidate.tier === tier)?.requiredFuse;
    return required !== undefined && Number.isFinite(required) && required > 0;
  })
    .map(tier => {
      const backendTier = skipLine?.tiers.find(candidate => candidate.tier === tier);
      const requiredFuse = Math.max(0, backendTier!.requiredFuse);
      const remainingFuse = Math.max(0, requiredFuse - balanceFuse);

      return {
        tier,
        requiredFuse,
        remainingFuse,
        unlocked: remainingFuse === 0,
        progressPct: requiredFuse > 0 ? Math.min(100, (balanceFuse / requiredFuse) * 100) : 0,
      };
    })
    .filter(target => TIER_RANK[target.tier] > TIER_RANK[currentTier] && !target.unlocked);
};

export const getBuyFuseProgress = (
  balanceFuse: number,
  enteredFuse: number,
  requiredFuse: number,
) => {
  if (requiredFuse <= 0) return 0;

  return Math.min(
    100,
    Math.max(0, ((Math.max(0, balanceFuse) + Math.max(0, enteredFuse)) / requiredFuse) * 100),
  );
};

export const hasReachedFuseTarget = (enteredFuse: number, remainingFuse: number) =>
  remainingFuse <= 0 || enteredFuse >= remainingFuse;

export const getNextBuyFuseTier = (
  targets: FuseSkipLineTier[],
  selectedTier: RewardsTier,
): RewardsTier | undefined => {
  if (targets.length === 0) return undefined;

  const currentIndex = targets.findIndex(target => target.tier === selectedTier);
  const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % targets.length : 0;

  return targets[nextIndex]?.tier;
};

export const getBuyFuseTierForAmount = (
  targets: FuseSkipLineTier[],
  enteredFuse: number,
): RewardsTier | undefined => {
  if (targets.length === 0) return undefined;

  const normalizedAmount = Math.max(0, enteredFuse);
  const highestReachedTarget = [...targets]
    .reverse()
    .find(target => normalizedAmount >= target.remainingFuse);

  return highestReachedTarget?.tier ?? targets[0]?.tier;
};
