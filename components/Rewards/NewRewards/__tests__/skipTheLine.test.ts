/// <reference types="jest" />
import { hasSkipTheLine } from '@/components/Rewards/NewRewards/skipTheLine';
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
