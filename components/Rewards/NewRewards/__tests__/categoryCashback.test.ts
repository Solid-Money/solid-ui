import { categoryCashbackPresentation } from '@/components/Rewards/NewRewards/categoryCashback';
import { RewardsTier } from '@/lib/types';

describe('category cashback presentation', () => {
  it('keeps the live subscription rate for the visible categories', () => {
    const result = categoryCashbackPresentation(RewardsTier.PRIME, 25);
    expect(result.rates).toEqual({ ai: 25, streaming: 25, music: 25 });
    expect(result.headlineRate).toBe(25);
    expect(result.actionLabel).toBe('Upgrade to Ultra');
  });

  it('keeps Ultra subscription categories and replaces the upgrade action with dismissal', () => {
    const result = categoryCashbackPresentation(RewardsTier.ULTRA, 20);
    expect(result.rates).toEqual({ ai: 20, streaming: 20, music: 20 });
    expect(result.actionLabel).toBe('Got it');
  });

  it('shows the locked Core offer without granting the preview benefit', () => {
    const result = categoryCashbackPresentation(RewardsTier.CORE, 0);
    expect(Object.values(result.rates)).toEqual([0, 0, 0]);
    expect(result.headlineRate).toBe(20);
    expect(result.actionLabel).toBe('Upgrade to Prime');
    expect(result.upgradeTier).toBe(RewardsTier.PRIME);
  });

  it('does not replace an explicit zero or invalid API rate with a design rate', () => {
    for (const rate of [0, -1, NaN, Infinity]) {
      const result = categoryCashbackPresentation(RewardsTier.PRIME, rate);
      expect(result.rates.ai).toBe(0);
      expect(result.rates.music).toBe(0);
      expect(result.headlineRate).toBe(0);
    }
  });

  it('bases the headline only on the visible subscription rate', () => {
    expect(categoryCashbackPresentation(RewardsTier.ULTRA, 5).headlineRate).toBe(5);
  });
});
