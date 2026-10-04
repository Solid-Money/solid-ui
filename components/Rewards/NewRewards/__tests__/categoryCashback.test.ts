import {
  categoryCashbackPresentation,
  unlockTierForCategory,
} from '@/components/Rewards/NewRewards/categoryCashback';
import { RewardsTier } from '@/lib/types';

/** The shape `rewards/user-data` sends for the current tier. */
const apiRates = (rates: Record<string, number>) =>
  Object.entries(rates).map(([key, rate]) => ({ key, label: key, rate }));

describe('category cashback presentation', () => {
  describe('with per-category rates from the API', () => {
    it("uses the API's rate for every category it reports", () => {
      const result = categoryCashbackPresentation(
        RewardsTier.PRIME,
        10,
        apiRates({ ai: 10, streaming: 10, music: 10, rides: 8, airlines: 0 }),
      );

      expect(result.rates).toEqual({ ai: 10, streaming: 10, music: 10, rides: 8, airlines: 0 });
      expect(result.headlineRate).toBe(10);
      expect(result.subtitle).toBe('on subscriptions and rides');
      expect(result.actionLabel).toBe('Upgrade to Ultra');
    });

    it('unlocks airlines for Ultra and drops the upgrade action', () => {
      const result = categoryCashbackPresentation(
        RewardsTier.ULTRA,
        20,
        apiRates({ ai: 20, streaming: 20, music: 20, rides: 10, airlines: 10 }),
      );

      expect(result.rates).toEqual({ ai: 20, streaming: 20, music: 20, rides: 10, airlines: 10 });
      expect(result.headlineRate).toBe(20);
      expect(result.subtitle).toBe('on subscriptions, rides and flights');
      expect(result.actionLabel).toBe('Got it');
    });

    // The API is the source of truth once it speaks: an admin who re-prices a
    // category in the portal must not be overridden by the design fallback.
    it('prefers the API rate over both the flat rate and the design fallback', () => {
      const result = categoryCashbackPresentation(
        RewardsTier.PRIME,
        10,
        apiRates({ ai: 12, rides: 3 }),
      );

      expect(result.rates.ai).toBe(12);
      expect(result.rates.rides).toBe(3);
      // Categories the API did not mention keep their design rate rather than
      // silently reading as locked.
      expect(result.rates.streaming).toBe(10);
      expect(result.headlineRate).toBe(12);
    });

    // The payload carries every configured category, including ones this app
    // has no tab or artwork for (Gaming, or anything added in the portal).
    it('ignores categories the sheet cannot render', () => {
      const result = categoryCashbackPresentation(
        RewardsTier.ULTRA,
        20,
        apiRates({ gaming: 50, fitness: 99, ai: 20 }),
      );

      expect(Object.keys(result.rates).sort()).toEqual([
        'ai',
        'airlines',
        'music',
        'rides',
        'streaming',
      ]);
      // Gaming's 50% must not become the headline for a sheet that never shows it.
      expect(result.headlineRate).toBe(20);
    });

    it('treats an unusable API rate as locked rather than NaN', () => {
      const result = categoryCashbackPresentation(
        RewardsTier.PRIME,
        10,
        apiRates({ ai: NaN, rides: -1, music: Infinity }),
      );

      expect(result.rates.ai).toBe(0);
      expect(result.rates.rides).toBe(0);
      expect(result.rates.music).toBe(0);
    });
  });

  describe('without per-category rates (older backend)', () => {
    it('spreads the flat rate over the subscription categories only', () => {
      const result = categoryCashbackPresentation(RewardsTier.PRIME, 25);

      expect(result.rates).toEqual({ ai: 25, streaming: 25, music: 25, rides: 8, airlines: 0 });
      expect(result.headlineRate).toBe(25);
      expect(result.actionLabel).toBe('Upgrade to Ultra');
    });

    it('keeps the design rides and airlines rates for Ultra', () => {
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

  // A category switched off in the admin portal is left out of the payload
  // entirely. It has to disappear from the sheet — reappearing at its design
  // rate would advertise cashback the backend has stopped paying.
  describe('categories an admin has switched off', () => {
    it('shows only the categories the API still reports', () => {
      const result = categoryCashbackPresentation(
        RewardsTier.PRIME,
        10,
        apiRates({ ai: 10, music: 10 }),
      );

      expect(result.categories).toEqual(['ai', 'music']);
    });

    it('keeps the sheet-wide tab order rather than the payload order', () => {
      const result = categoryCashbackPresentation(
        RewardsTier.ULTRA,
        20,
        apiRates({ rides: 10, ai: 20, streaming: 20 }),
      );

      expect(result.categories).toEqual(['ai', 'streaming', 'rides']);
    });

    it('leaves a paused category out of the headline', () => {
      // Ultra's best live rate is Rides' 10%, because the 20% categories are off.
      const result = categoryCashbackPresentation(RewardsTier.ULTRA, 20, apiRates({ rides: 10 }));

      expect(result.headlineRate).toBe(10);
    });

    it('stops the subtitle promising a category that is off', () => {
      expect(
        categoryCashbackPresentation(RewardsTier.ULTRA, 20, apiRates({ ai: 20, airlines: 10 }))
          .subtitle,
      ).toBe('on subscriptions and flights');
      expect(
        categoryCashbackPresentation(RewardsTier.ULTRA, 20, apiRates({ rides: 10 })).subtitle,
      ).toBe('on rides');
    });

    it('renders nothing when every category it knows is off', () => {
      const result = categoryCashbackPresentation(RewardsTier.PRIME, 10, apiRates({ gaming: 10 }));

      expect(result.categories).toEqual([]);
      expect(result.headlineRate).toBe(0);
      expect(result.subtitle).toBe('on eligible card spend');
    });

    // Nothing to hide on a backend that cannot express the toggle.
    it('shows every category when the API sends no per-category rates', () => {
      expect(categoryCashbackPresentation(RewardsTier.PRIME, 10).categories).toEqual([
        'ai',
        'streaming',
        'music',
        'rides',
        'airlines',
      ]);
    });
  });

  // The tier comparison page labels a locked category with the tier that would
  // unlock it, and that is a question about config, not a fact about the
  // category: Airlines reads "Ultra" only because Prime's rate on it is 0.
  describe('unlockTierForCategory', () => {
    const tierRates = (tier: RewardsTier, entries: Record<string, number>) => ({
      tier,
      subscriptionCategoryRates: apiRates(entries),
    });

    const shipped = [
      tierRates(RewardsTier.CORE, { ai: 0, rides: 0, airlines: 0 }),
      tierRates(RewardsTier.PRIME, { ai: 10, rides: 8, airlines: 0 }),
      tierRates(RewardsTier.ULTRA, { ai: 20, rides: 10, airlines: 10 }),
    ];

    it('names the cheapest tier that earns on the category', () => {
      expect(unlockTierForCategory('ai', shipped)).toBe(RewardsTier.PRIME);
      expect(unlockTierForCategory('airlines', shipped)).toBe(RewardsTier.ULTRA);
    });

    it('follows a re-priced category down the ladder', () => {
      const primeEarnsOnAirlines = [
        tierRates(RewardsTier.CORE, { airlines: 0 }),
        tierRates(RewardsTier.PRIME, { airlines: 8 }),
        tierRates(RewardsTier.ULTRA, { airlines: 10 }),
      ];

      expect(unlockTierForCategory('airlines', primeEarnsOnAirlines)).toBe(RewardsTier.PRIME);
    });

    it('names Core when Core itself earns on it', () => {
      expect(unlockTierForCategory('ai', [tierRates(RewardsTier.CORE, { ai: 1 })])).toBe(
        RewardsTier.CORE,
      );
    });

    it('answers undefined when no tier earns on it, or nothing is loaded', () => {
      expect(unlockTierForCategory('music', shipped)).toBeUndefined();
      expect(unlockTierForCategory('ai', [])).toBeUndefined();
      expect(
        unlockTierForCategory('ai', [{ tier: RewardsTier.PRIME, subscriptionCategoryRates: [] }]),
      ).toBeUndefined();
    });
  });

  // Core advertises the ceiling an upgrade reaches, so it must never fall to 0
  // just because the tier itself earns nothing.
  it('keeps the Core headline at the best rate any tier reaches', () => {
    const result = categoryCashbackPresentation(
      RewardsTier.CORE,
      0,
      apiRates({ ai: 0, streaming: 0, music: 0, rides: 0, airlines: 0 }),
    );

    expect(result.headlineRate).toBe(20);
    expect(result.subtitle).toBe('on subscriptions, rides and flights with Prime or Ultra');
  });
});
