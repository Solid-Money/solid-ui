/// <reference types="jest" />
import {
  chunkIntoRows,
  resolveTierBenefitKeys,
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
