import {
  categoryCashbackPresentation,
  unlockTierForCategory,
} from '@/components/Rewards/NewRewards/categoryCashback';
import { RewardsTier } from '@/lib/types';

/** The shape `rewards/user-data` sends for the current tier. */
const apiRates = (rates: Record<string, number>) =>
  Object.entries(rates).map(([key, rate]) => ({ key, label: key, rate }));

describe('category cashback presentation', () => {
  /** The categories a result renders, as `{key: rate}` for readable assertions. */
  const shown = (result: { categories: { key: string; rate: number }[] }) =>
    Object.fromEntries(result.categories.map(category => [category.key, category.rate]));

  describe('with per-category rates from the API', () => {
    it("uses the API's list, labels and rates", () => {
      const result = categoryCashbackPresentation(
        RewardsTier.PRIME,
        10,
        apiRates({ ai: 10, streaming: 10, music: 10, rides: 8, airlines: 0 }),
      );

      expect(shown(result)).toEqual({ ai: 10, streaming: 10, music: 10, rides: 8, airlines: 0 });
      expect(result.headlineRate).toBe(10);
      expect(result.actionLabel).toBe('Upgrade to Ultra');
    });

    it('unlocks airlines for Ultra and drops the upgrade action', () => {
      const result = categoryCashbackPresentation(
        RewardsTier.ULTRA,
        20,
        apiRates({ ai: 20, streaming: 20, music: 20, rides: 10, airlines: 10 }),
      );

      expect(shown(result)).toEqual({ ai: 20, streaming: 20, music: 20, rides: 10, airlines: 10 });
      expect(result.headlineRate).toBe(20);
      expect(result.actionLabel).toBe('Got it');
    });

    // The API is the source of truth once it speaks: an admin who re-prices a
    // category in the portal must not be overridden by the design fallback.
    it('prefers the API rate over the design fallback', () => {
      const result = categoryCashbackPresentation(
        RewardsTier.PRIME,
        10,
        apiRates({ ai: 12, rides: 3 }),
      );

      expect(result.rateFor('ai')).toBe(12);
      expect(result.rateFor('rides')).toBe(3);
      expect(result.headlineRate).toBe(12);
    });

    // The whole point of reading the list from the API: a category nobody has
    // drawn logos for still has to appear, or the sheet disagrees with what the
    // backend is paying. Its artwork is the caller's problem, not this one's.
    it('keeps Gaming and categories this app has no artwork for', () => {
      const result = categoryCashbackPresentation(
        RewardsTier.ULTRA,
        20,
        apiRates({ gaming: 50, fitness: 15, ai: 20 }),
      );

      expect(Object.keys(shown(result))).toEqual(['gaming', 'fitness', 'ai']);
      expect(result.rateFor('gaming')).toBe(50);
      expect(result.headlineRate).toBe(50);
    });

    it('names a category with the API label, falling back to its key', () => {
      const result = categoryCashbackPresentation(RewardsTier.PRIME, 10, [
        { key: 'fitness', label: 'Gyms & Fitness', rate: 7 },
        { key: 'books', label: '', rate: 5 },
      ]);

      expect(result.categories.map(category => category.label)).toEqual([
        'Gyms & Fitness',
        'books',
      ]);
    });

    it('renders in the order the API sends', () => {
      const result = categoryCashbackPresentation(
        RewardsTier.ULTRA,
        20,
        apiRates({ rides: 10, ai: 20, streaming: 20 }),
      );

      expect(result.categories.map(category => category.key)).toEqual(['rides', 'ai', 'streaming']);
    });

    it('treats an unusable API rate as locked rather than NaN', () => {
      const result = categoryCashbackPresentation(
        RewardsTier.PRIME,
        10,
        apiRates({ ai: NaN, rides: -1, music: Infinity }),
      );

      expect(shown(result)).toEqual({ ai: 0, rides: 0, music: 0 });
    });

    it('drops an entry with no usable key', () => {
      const result = categoryCashbackPresentation(RewardsTier.PRIME, 10, [
        { key: '', label: 'Nameless', rate: 9 },
        { key: 'ai', label: 'AI', rate: 10 },
      ]);

      expect(result.categories.map(category => category.key)).toEqual(['ai']);
    });
  });

  describe('without per-category rates (older backend)', () => {
    it('spreads the flat rate over the subscription categories only', () => {
      const result = categoryCashbackPresentation(RewardsTier.PRIME, 25);

      expect(shown(result)).toEqual({
        ai: 25,
        streaming: 25,
        music: 25,
        gaming: 25,
        rides: 8,
        airlines: 0,
      });
      expect(result.headlineRate).toBe(25);
      expect(result.actionLabel).toBe('Upgrade to Ultra');
    });

    it('keeps the design rides and airlines rates for Ultra', () => {
      const result = categoryCashbackPresentation(RewardsTier.ULTRA, 20);

      expect(shown(result)).toEqual({
        ai: 20,
        streaming: 20,
        music: 20,
        gaming: 20,
        rides: 10,
        airlines: 10,
      });
      expect(result.actionLabel).toBe('Got it');
    });

    it('shows the locked Core offer without granting the preview benefit', () => {
      const result = categoryCashbackPresentation(RewardsTier.CORE, 0);

      expect(Object.values(shown(result))).toEqual([0, 0, 0, 0, 0, 0]);
      expect(result.headlineRate).toBe(20);
      expect(result.actionLabel).toBe('Upgrade to Prime');
      expect(result.upgradeTier).toBe(RewardsTier.PRIME);
    });

    it('does not replace an explicit zero or invalid rate with a design rate', () => {
      for (const rate of [0, -1, NaN, Infinity]) {
        const result = categoryCashbackPresentation(RewardsTier.PRIME, rate);
        expect(result.rateFor('ai')).toBe(0);
        expect(result.rateFor('music')).toBe(0);
        expect(result.headlineRate).toBe(8);
      }
    });

    it('bases the headline on the highest unlocked category rate', () => {
      expect(categoryCashbackPresentation(RewardsTier.ULTRA, 5).headlineRate).toBe(10);
    });
  });

  // A category switched off in the admin portal is left out of the payload
  // entirely. It has to disappear — reappearing at a design rate would
  // advertise cashback the backend has stopped paying.
  describe('categories an admin has switched off', () => {
    it('shows only the categories the API still reports', () => {
      const result = categoryCashbackPresentation(
        RewardsTier.PRIME,
        10,
        apiRates({ ai: 10, music: 10 }),
      );

      expect(result.categories.map(category => category.key)).toEqual(['ai', 'music']);
      expect(result.rateFor('streaming')).toBe(0);
    });

    it('leaves a paused category out of the headline', () => {
      // Ultra's best live rate is Rides' 10%, because the 20% categories are off.
      const result = categoryCashbackPresentation(RewardsTier.ULTRA, 20, apiRates({ rides: 10 }));

      expect(result.headlineRate).toBe(10);
    });

    it('renders nothing when the API reports no categories at all', () => {
      const result = categoryCashbackPresentation(RewardsTier.PRIME, 10, [
        { key: '', label: '', rate: 0 },
      ]);

      expect(result.categories).toEqual([]);
      expect(result.headlineRate).toBe(0);
      expect(result.subtitle).toBe('on eligible card spend');
    });

    // Nothing to hide on a backend that cannot express the toggle.
    it('shows every design category when the API sends no list', () => {
      expect(
        categoryCashbackPresentation(RewardsTier.PRIME, 10).categories.map(
          category => category.key,
        ),
      ).toEqual(['ai', 'streaming', 'music', 'gaming', 'rides', 'airlines']);
    });
  });

  // The subtitle used to be a fixed phrase naming "subscriptions, rides and
  // flights", which became a lie the first time a category was paused or a
  // sixth was added. It is built from the live labels instead.
  describe('subtitle', () => {
    it('names the categories the tier actually earns on', () => {
      expect(
        categoryCashbackPresentation(
          RewardsTier.PRIME,
          10,
          apiRates({ ai: 10, streaming: 10, rides: 8, airlines: 0 }),
        ).subtitle,
      ).toBe('on ai, streaming and rides');
    });

    it('names a category the admin added', () => {
      expect(
        categoryCashbackPresentation(RewardsTier.ULTRA, 20, [
          { key: 'fitness', label: 'Fitness', rate: 9 },
        ]).subtitle,
      ).toBe('on Fitness');
    });

    it('advertises the whole offer on Core, which earns nothing', () => {
      expect(
        categoryCashbackPresentation(RewardsTier.CORE, 0, apiRates({ ai: 0, rides: 0 })).subtitle,
      ).toBe('on ai and rides with Prime or Ultra');
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
    expect(result.subtitle).toBe('on ai, streaming, music, rides and airlines with Prime or Ultra');
  });
});
