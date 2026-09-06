import {
  getBuyFuseProgress,
  getBuyFuseTierForAmount,
  getBuyFuseTierTargets,
  getNextBuyFuseTier,
  hasReachedFuseTarget,
} from '@/lib/buyFuseTiers';
import { FuseSkipLine, RewardsTier } from '@/lib/types';

const liveThresholds: FuseSkipLine = {
  enabled: true,
  balanceFuse: 0,
  balanceUsd: 0,
  unlockedTier: RewardsTier.CORE,
  tiers: [
    {
      tier: RewardsTier.PRIME,
      requiredFuse: 50000,
      remainingFuse: 50000,
      unlocked: false,
      progressPct: 0,
    },
    {
      tier: RewardsTier.ULTRA,
      requiredFuse: 400000,
      remainingFuse: 400000,
      unlocked: false,
      progressPct: 0,
    },
  ],
};

describe('buy FUSE tier targets', () => {
  it('does not offer an upgrade without enabled backend thresholds', () => {
    expect(getBuyFuseTierTargets(RewardsTier.CORE)).toEqual([]);
    expect(getBuyFuseTierTargets(RewardsTier.CORE, { ...liveThresholds, enabled: false })).toEqual(
      [],
    );
    expect(getBuyFuseTierTargets(RewardsTier.CORE, { ...liveThresholds, tiers: [] })).toEqual([]);
  });

  it('uses live thresholds and subtracts the FUSE already held in savings', () => {
    const targets = getBuyFuseTierTargets(RewardsTier.CORE, {
      enabled: true,
      balanceFuse: 10_000,
      balanceUsd: 300,
      unlockedTier: RewardsTier.CORE,
      tiers: [
        {
          tier: RewardsTier.PRIME,
          requiredFuse: 60_000,
          remainingFuse: 1,
          unlocked: false,
          progressPct: 1,
        },
        {
          tier: RewardsTier.ULTRA,
          requiredFuse: 500_000,
          remainingFuse: 1,
          unlocked: false,
          progressPct: 1,
        },
      ],
    });

    expect(targets).toMatchObject([
      { tier: RewardsTier.PRIME, requiredFuse: 60_000, remainingFuse: 50_000 },
      { tier: RewardsTier.ULTRA, requiredFuse: 500_000, remainingFuse: 490_000 },
    ]);
  });

  it('only offers tiers above the current one', () => {
    expect(getBuyFuseTierTargets(RewardsTier.PRIME, liveThresholds)).toMatchObject([
      { tier: RewardsTier.ULTRA },
    ]);
    expect(getBuyFuseTierTargets(RewardsTier.ULTRA, liveThresholds)).toEqual([]);
  });

  it('turns green only when the entered amount reaches the remaining threshold', () => {
    expect(hasReachedFuseTarget(49_999, 50_000)).toBe(false);
    expect(hasReachedFuseTarget(50_000, 50_000)).toBe(true);
  });

  it('adds the entered FUSE to existing savings progress and clamps at 100%', () => {
    expect(getBuyFuseProgress(10_000, 20_000, 50_000)).toBe(60);
    expect(getBuyFuseProgress(10_000, 60_000, 50_000)).toBe(100);
  });

  it('toggles the target from Prime to Ultra and back to Prime', () => {
    const targets = getBuyFuseTierTargets(RewardsTier.CORE, liveThresholds);

    expect(getNextBuyFuseTier(targets, RewardsTier.PRIME)).toBe(RewardsTier.ULTRA);
    expect(getNextBuyFuseTier(targets, RewardsTier.ULTRA)).toBe(RewardsTier.PRIME);
  });

  it('selects the highest tier reached by a manually entered amount', () => {
    const targets = getBuyFuseTierTargets(RewardsTier.CORE, liveThresholds);

    expect(getBuyFuseTierForAmount(targets, 0)).toBe(RewardsTier.PRIME);
    expect(getBuyFuseTierForAmount(targets, 49_999)).toBe(RewardsTier.PRIME);
    expect(getBuyFuseTierForAmount(targets, 50_000)).toBe(RewardsTier.PRIME);
    expect(getBuyFuseTierForAmount(targets, 399_999)).toBe(RewardsTier.PRIME);
    expect(getBuyFuseTierForAmount(targets, 400_000)).toBe(RewardsTier.ULTRA);
  });
});
