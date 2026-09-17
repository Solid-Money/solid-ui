import {
  formatTierCashbackRate,
  resolveTierCashbackRate,
  resolveUserCashbackRate,
  TIER_CASHBACK_RATES,
} from '@/lib/tierCashback';
import { RewardsTier, RewardsUserData } from '@/lib/types';

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

/**
 * Support can put one account on a rate of its own. That rate is what their
 * spend actually earns, so it has to survive the launch-rate override — the one
 * case where quoting the same number everywhere would quote a number we are not
 * going to pay.
 *
 * These run with the override on, which is its default.
 */
describe('resolveUserCashbackRate', () => {
  const rewards = (data: Partial<RewardsUserData>) => data as RewardsUserData;

  it('quotes a rate pinned to this user over the launch rate for their tier', () => {
    expect(
      resolveUserCashbackRate(
        rewards({ currentTier: RewardsTier.CORE, cashbackRate: 8, hasCustomCashbackRate: true }),
      ),
    ).toBe(8);
  });

  it('quotes the launch rate when nothing is pinned to them', () => {
    expect(
      resolveUserCashbackRate(
        rewards({ currentTier: RewardsTier.CORE, cashbackRate: 2, hasCustomCashbackRate: false }),
      ),
    ).toBe(3);
  });

  it('quotes the launch rate against a backend that does not report the flag', () => {
    // The field is absent on older backends, where `cashbackRate` is the tier
    // rate anyway — so the pre-existing behaviour has to be what absence means.
    expect(
      resolveUserCashbackRate(rewards({ currentTier: RewardsTier.PRIME, cashbackRate: 3 })),
    ).toBe(4);
  });

  it('quotes a pinned zero, which is a decision and not an absence', () => {
    expect(
      resolveUserCashbackRate(
        rewards({ currentTier: RewardsTier.ULTRA, cashbackRate: 0, hasCustomCashbackRate: true }),
      ),
    ).toBe(0);
  });

  it('falls back to the tier when the flag arrives without a usable rate', () => {
    expect(
      resolveUserCashbackRate(
        rewards({ currentTier: RewardsTier.PRIME, hasCustomCashbackRate: true }),
      ),
    ).toBe(4);
  });

  it('takes the caller’s tier when it has already resolved one', () => {
    // The rewards screen defaults to Core while the request is in flight.
    expect(resolveUserCashbackRate(undefined, RewardsTier.ULTRA)).toBe(5);
    expect(resolveUserCashbackRate(undefined)).toBe(0);
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
