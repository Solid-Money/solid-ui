import {
  TIER_STAR_SIZES,
  tierStarOffset,
} from '@/components/Rewards/NewRewards/TierHero/starLayout';
import { RewardsTier } from '@/lib/types';

describe('tierStarOffset', () => {
  it('only nudges Prime — the other two stars are centred in their own canvas', () => {
    expect(tierStarOffset(RewardsTier.CORE)).toBeUndefined();
    expect(tierStarOffset(RewardsTier.ULTRA)).toBeUndefined();
    expect(tierStarOffset(RewardsTier.PRIME)).toBeDefined();
  });

  it('nudges the hero star by the measured 5px', () => {
    const [{ translateY }] = tierStarOffset(RewardsTier.PRIME)!;
    expect(translateY).toBeCloseTo(-5, 5);
  });

  /**
   * The bug this guards. The -5 was measured against the 235px hero, where it
   * is 2% of the height. Applied flat to the 28px star beside a heading it is
   * 18%, which is a glyph visibly adrift from its own text — which is exactly
   * how it shipped on the upgrade screen.
   */
  it('scales the nudge with the size the star is drawn at', () => {
    const [{ translateY }] = tierStarOffset(RewardsTier.PRIME, 28)!;

    expect(translateY).toBeCloseTo((-5 * 28) / TIER_STAR_SIZES[RewardsTier.PRIME], 5);
    // Under a third of a pixel at this size: present, and not something the eye
    // can pick out as misalignment.
    expect(Math.abs(translateY)).toBeLessThan(1);
  });

  it('never moves a star further than the measured nudge', () => {
    for (const size of [8, 28, 64, 120, TIER_STAR_SIZES[RewardsTier.PRIME]]) {
      const [{ translateY }] = tierStarOffset(RewardsTier.PRIME, size)!;
      expect(Math.abs(translateY)).toBeLessThanOrEqual(5);
    }
  });
});
