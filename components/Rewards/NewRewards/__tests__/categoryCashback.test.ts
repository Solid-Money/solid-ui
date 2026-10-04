import { categoryCashbackPresentation } from '@/components/Rewards/NewRewards/categoryCashback';
import { RewardsTier } from '@/lib/types';

describe('category cashback presentation', () => {
  it('keeps the live subscription rate and uses the Prime ride rate', () => {
    const result = categoryCashbackPresentation(RewardsTier.PRIME, 25);
    expect(result.rates).toEqual({ ai: 25, streaming: 25, music: 25, rides: 8, airlines: 0 });
    expect(result.headlineRate).toBe(25);
    expect(result.actionLabel).toBe('Upgrade to Ultra');
  });

  it('unlocks airlines for Ultra and replaces the upgrade action with dismissal', () => {
    const result = categoryCashbackPresentation(RewardsTier.ULTRA, 20);
    expect(result.rates).toEqual({ ai: 20, streaming: 20, music: 20, rides: 10, airlines: 10 });
    expect(result.actionLabel).toBe('Got it');
  });

  it('shows the locked Core offer without granting the preview benefit', () => {
    const result = categoryCashbackPresentation(RewardsTier.CORE, 0);
    expect(Object.values(result.rates)).toEqual([0, 0, 0, 0, 0]);
    expect(result.headlineRate).toBe(20);
    expect(result.actionLabel).toBe('Upgrade to Prime');
    expect(result.upgradeTier).toBe(RewardsTier.PRIME);
  });

  it('does not replace an explicit zero or invalid API rate with a design rate', () => {
    for (const rate of [0, -1, NaN, Infinity]) {
      const result = categoryCashbackPresentation(RewardsTier.PRIME, rate);
      expect(result.rates.ai).toBe(0);
      expect(result.rates.music).toBe(0);
      expect(result.headlineRate).toBe(8);
    }
  });

  it('bases the headline on the highest unlocked category rate', () => {
    expect(categoryCashbackPresentation(RewardsTier.ULTRA, 5).headlineRate).toBe(10);
  });
});
