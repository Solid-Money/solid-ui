import {
  formatTierCashbackRate,
  resolveTierCashbackRate,
  TIER_CASHBACK_RATES,
} from '@/lib/tierCashback';
import { RewardsTier } from '@/lib/types';

/**
 * The rewards API still reports the pre-launch cashback rates, so until the
 * admin-configured ones are live the app quotes the launch rates itself. The
 * override has to be a pure display swap: with the flag off, callers must get
 * back exactly the number the API sent.
 */
describe('resolveTierCashbackRate', () => {
  it('quotes the launch rate for each tier', () => {
    expect(resolveTierCashbackRate(RewardsTier.CORE, 2, true)).toBe(3);
    expect(resolveTierCashbackRate(RewardsTier.PRIME, 3, true)).toBe(4);
    expect(resolveTierCashbackRate(RewardsTier.ULTRA, 5, true)).toBe(5);
  });

  it('hands back the API rate untouched once the flag is off', () => {
    expect(resolveTierCashbackRate(RewardsTier.CORE, 2, false)).toBe(2);
    expect(resolveTierCashbackRate(RewardsTier.ULTRA, 7.5, false)).toBe(7.5);
  });

  it('falls back to the API rate for a tier this build does not know', () => {
    // `currentTier` is API JSON: a backend that has moved ahead of the app can
    // name a tier with no fixed rate to quote, and its own number beats zero.
    const unknownTier = 'quantum' as RewardsTier;

    expect(resolveTierCashbackRate(unknownTier, 6, true)).toBe(6);
    expect(resolveTierCashbackRate(unknownTier, undefined, true)).toBe(0);
  });

  it('treats a missing or nonsense API rate as zero, flag either way', () => {
    const bogus = [undefined, null, NaN, '4'] as unknown as (number | undefined)[];

    for (const rate of bogus) {
      expect(resolveTierCashbackRate(undefined, rate, true)).toBe(0);
      expect(resolveTierCashbackRate(undefined, rate, false)).toBe(0);
    }
  });

  it('quotes the tier rate even before the API rate lands', () => {
    // The rewards screen renders Core defaults while the request is in flight;
    // "3%" is the right number to show there, not "0%".
    expect(resolveTierCashbackRate(RewardsTier.CORE, undefined, true)).toBe(3);
  });
});

describe('formatTierCashbackRate', () => {
  it('prints the rate the way the tier screens do', () => {
    expect(formatTierCashbackRate(RewardsTier.CORE)).toBe('3%');
    expect(formatTierCashbackRate(RewardsTier.PRIME)).toBe('4%');
    expect(formatTierCashbackRate(RewardsTier.ULTRA)).toBe('5%');
  });

  it('covers every tier, so no screen can print an empty rate', () => {
    for (const tier of Object.values(RewardsTier)) {
      expect(TIER_CASHBACK_RATES[tier]).toBeGreaterThan(0);
    }
  });
});
