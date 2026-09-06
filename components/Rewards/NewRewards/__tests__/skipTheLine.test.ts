/// <reference types="jest" />
import {
  hasSkipTheLine,
  resolveTierUpgradeCardData,
} from '@/components/Rewards/NewRewards/skipTheLine';
import { RewardsTier } from '@/lib/types';

import type { FuseSkipLine } from '@/lib/types';

/**
 * "Skip the line" is the FUSE shortcut past the points ladder. It must not
 * appear unless the backend says the mechanic is actually live — an empty or
 * switched-off section would advertise a deposit that grants nothing.
 */
const skipLine = (overrides: Partial<FuseSkipLine> = {}): FuseSkipLine => ({
  enabled: true,
  balanceFuse: 128_000,
  balanceUsd: 2_000,
  unlockedTier: RewardsTier.PRIME,
  tiers: [
    {
      tier: RewardsTier.PRIME,
      requiredFuse: 50_000,
      unlocked: true,
      remainingFuse: 0,
      progressPct: 100,
    },
    {
      tier: RewardsTier.ULTRA,
      requiredFuse: 400_000,
      unlocked: false,
      remainingFuse: 272_000,
      progressPct: 32,
    },
  ],
  ...overrides,
});

describe('hasSkipTheLine', () => {
  it('shows the section when the mechanic is live and rungs are priced', () => {
    expect(hasSkipTheLine(skipLine())).toBe(true);
  });

  it('hides it on a backend that does not send the block', () => {
    expect(hasSkipTheLine(undefined)).toBe(false);
  });

  it('hides it when the admin kill-switch is off', () => {
    expect(hasSkipTheLine(skipLine({ enabled: false }))).toBe(false);
  });

  it('hides it when no rungs are configured', () => {
    expect(hasSkipTheLine(skipLine({ tiers: [] }))).toBe(false);
  });

  it('still shows it for a user holding no FUSE — that is the sales pitch', () => {
    expect(
      hasSkipTheLine(
        skipLine({
          balanceFuse: 0,
          balanceUsd: 0,
          unlockedTier: RewardsTier.CORE,
        }),
      ),
    ).toBe(true);
  });
});

describe('resolveTierUpgradeCardData', () => {
  it('shows the Prime card with launch defaults when rewards data is unavailable in preview', () => {
    const result = resolveTierUpgradeCardData({
      currentTier: RewardsTier.CORE,
      allowFallback: true,
    });

    expect(result.showTierUpgradeCard).toBe(true);
    expect(result.nextTier).toBe(RewardsTier.PRIME);
    expect(result.targetPoints).toBe(5_000_000);
    expect(result.skipLine?.tiers.find(tier => tier.tier === RewardsTier.PRIME)).toMatchObject({
      requiredFuse: 50_000,
      remainingFuse: 50_000,
    });
  });

  it('shows the Ultra card with launch defaults for a Prime user on an older backend', () => {
    const result = resolveTierUpgradeCardData({
      currentTier: RewardsTier.PRIME,
      nextTier: RewardsTier.ULTRA,
      allowFallback: true,
    });

    expect(result.showTierUpgradeCard).toBe(true);
    expect(result.targetPoints).toBe(35_000_000);
    expect(result.skipLine?.tiers).toEqual([
      expect.objectContaining({ tier: RewardsTier.ULTRA, requiredFuse: 400_000 }),
    ]);
  });

  it('does not invent an upgrade card in production when the backend block is absent', () => {
    const result = resolveTierUpgradeCardData({
      currentTier: RewardsTier.CORE,
      allowFallback: false,
    });

    expect(result.showTierUpgradeCard).toBe(false);
  });

  it('respects an explicit backend kill-switch in preview', () => {
    const disabledSkipLine = skipLine({ enabled: false });
    const result = resolveTierUpgradeCardData({
      currentTier: RewardsTier.CORE,
      nextTier: RewardsTier.PRIME,
      targetPoints: 6_000_000,
      skipLine: disabledSkipLine,
      allowFallback: true,
    });

    expect(result.showTierUpgradeCard).toBe(false);
    expect(result.skipLine).toBe(disabledSkipLine);
  });

  it('keeps backend thresholds when the live mechanic is available', () => {
    const liveSkipLine = skipLine({
      balanceFuse: 10_000,
      tiers: [
        {
          tier: RewardsTier.PRIME,
          requiredFuse: 60_000,
          unlocked: false,
          remainingFuse: 50_000,
          progressPct: 16.67,
        },
      ],
    });
    const result = resolveTierUpgradeCardData({
      currentTier: RewardsTier.CORE,
      nextTier: RewardsTier.PRIME,
      targetPoints: 6_000_000,
      skipLine: liveSkipLine,
      allowFallback: true,
    });

    expect(result.showTierUpgradeCard).toBe(true);
    expect(result.targetPoints).toBe(6_000_000);
    expect(result.skipLine).toBe(liveSkipLine);
  });
});
