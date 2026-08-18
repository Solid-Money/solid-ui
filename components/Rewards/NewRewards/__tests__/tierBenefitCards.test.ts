/// <reference types="jest" />
import {
  chunkIntoRows,
  PREVIEW_BENEFIT_RATES,
  resolveTierBenefitKeys,
  resolveTierBenefitRates,
} from '@/components/Rewards/NewRewards/tierBenefitCards';

/**
 * "Your tier benefits" must only show perks the user's tier actually grants.
 *
 * The screen used to render one fixed set of cards for everyone, so a Core user
 * saw a yield boost and subscription cashback they hadn't unlocked and couldn't
 * act on. Gating is driven off the rates the backend reports for the CURRENT
 * tier: zero means not unlocked, and the card doesn't render at all.
 */
describe('resolveTierBenefitKeys', () => {
  it('gives every tier cashback and referrals', () => {
    expect(
      resolveTierBenefitKeys({ yieldBoostPercentage: 0, subscriptionDiscountRate: 0 }),
    ).toEqual(['cashback', 'referrals']);
  });

  it('adds the yield boost and subscription cards once the tier unlocks them', () => {
    expect(
      resolveTierBenefitKeys({ yieldBoostPercentage: 2, subscriptionDiscountRate: 25 }),
    ).toEqual(['cashback', 'referrals', 'yield-boost', 'subscription']);
  });

  it('gates each perk independently', () => {
    expect(
      resolveTierBenefitKeys({ yieldBoostPercentage: 2, subscriptionDiscountRate: 0 }),
    ).toEqual(['cashback', 'referrals', 'yield-boost']);
    expect(
      resolveTierBenefitKeys({ yieldBoostPercentage: 0, subscriptionDiscountRate: 50 }),
    ).toEqual(['cashback', 'referrals', 'subscription']);
  });

  it('treats missing or nonsense rates as not unlocked', () => {
    // An older backend omits these fields entirely, and the screen coerces the
    // absent values to 0 — rendering "+undefined% Yield Boost" would be worse
    // than rendering nothing.
    const bogus = [undefined, null, NaN, Infinity, -2] as unknown as number[];

    for (const rate of bogus) {
      expect(
        resolveTierBenefitKeys({ yieldBoostPercentage: rate, subscriptionDiscountRate: rate }),
      ).toEqual(['cashback', 'referrals']);
    }
  });
});

/**
 * Off production, a locked perk is previewed at stock Prime rates so design QA
 * can review the yield boost and subscription cards from an ordinary Core test
 * account. Production must keep showing only what the tier really grants.
 */
describe('resolveTierBenefitRates', () => {
  const core = {
    yieldBoostPercentage: 0,
    yieldBoostCap: 0,
    yieldBoostEarned: 0,
    subscriptionDiscountRate: 0,
  };
  const ultra = {
    yieldBoostPercentage: 5,
    yieldBoostCap: 100,
    yieldBoostEarned: 420.65,
    subscriptionDiscountRate: 50,
  };

  it('passes rates straight through when preview is off', () => {
    expect(resolveTierBenefitRates(core, false)).toEqual(core);
    expect(resolveTierBenefitRates(ultra, false)).toEqual(ultra);
  });

  it('leaves a Core tier with no cards in production', () => {
    expect(resolveTierBenefitKeys(resolveTierBenefitRates(core, false))).toEqual([
      'cashback',
      'referrals',
    ]);
  });

  it('substitutes preview rates for locked perks so all four cards render', () => {
    const previewed = resolveTierBenefitRates(core, true);

    expect(previewed).toEqual({
      ...PREVIEW_BENEFIT_RATES,
      yieldBoostEarned: 0,
    });
    expect(resolveTierBenefitKeys(previewed)).toEqual([
      'cashback',
      'referrals',
      'yield-boost',
      'subscription',
    ]);
  });

  it('never overwrites rates the tier really grants', () => {
    expect(resolveTierBenefitRates(ultra, true)).toEqual(ultra);
  });

  it('substitutes each locked perk independently', () => {
    const boostOnly = { ...core, yieldBoostPercentage: 3, yieldBoostCap: 75 };

    expect(resolveTierBenefitRates(boostOnly, true)).toEqual({
      yieldBoostPercentage: 3,
      yieldBoostCap: 75,
      yieldBoostEarned: 0,
      subscriptionDiscountRate: PREVIEW_BENEFIT_RATES.subscriptionDiscountRate,
    });
  });

  it('reports real earnings rather than inventing them', () => {
    // A Core account previewing the boost has genuinely earned nothing, and the
    // sheet and savings strip should say so.
    expect(
      resolveTierBenefitRates({ ...core, yieldBoostEarned: 12.5 }, true).yieldBoostEarned,
    ).toBe(12.5);
    expect(resolveTierBenefitRates(core, true).yieldBoostEarned).toBe(0);
  });
});

describe('chunkIntoRows', () => {
  it('lays cards out two per row', () => {
    expect(chunkIntoRows(['a', 'b', 'c', 'd'])).toEqual([
      ['a', 'b'],
      ['c', 'd'],
    ]);
  });

  it('leaves a trailing odd card in its own row rather than dropping it', () => {
    expect(chunkIntoRows(['a', 'b', 'c'])).toEqual([['a', 'b'], ['c']]);
  });

  it('handles the empty case', () => {
    expect(chunkIntoRows([])).toEqual([]);
  });
});
