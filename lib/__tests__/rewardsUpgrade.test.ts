import { getConfirmedUpgradeBenefits, getTierAction, isHigherTier } from '@/lib/rewardsUpgrade';
import { RewardsTier, RewardsUserData } from '@/lib/types';

const { CORE, PRIME, ULTRA } = RewardsTier;

describe('tier actions', () => {
  test.each([
    [CORE, CORE, 'current'],
    [PRIME, CORE, 'upgrade'],
    [ULTRA, CORE, 'upgrade'],
    [CORE, PRIME, 'included'],
    [PRIME, PRIME, 'current'],
    [ULTRA, PRIME, 'upgrade'],
    [CORE, ULTRA, 'included'],
    [PRIME, ULTRA, 'included'],
    [ULTRA, ULTRA, 'current'],
  ] as const)('%s selected with %s held is %s', (selected, current, action) => {
    expect(getTierAction(selected, current)).toBe(action);
  });
  it('fails closed without a confirmed tier or on fetch failure', () => {
    expect(getTierAction(PRIME)).toBe('unavailable');
    expect(getTierAction(ULTRA, CORE, true)).toBe('unavailable');
    expect(isHigherTier(PRIME, undefined)).toBe(false);
  });
  it('uses the actual response values and omits absent or unavailable benefits', () => {
    const data = {
      cashbackRate: 1.75,
      maxCashbackMonthly: 87,
      yieldBoostPercentage: 0,
      subscriptionDiscountRate: 25,
      subscriptionCategoryLimit: 0,
    } as RewardsUserData;
    expect(getConfirmedUpgradeBenefits(data)).toEqual([
      '1.75% card cashback',
      '$87 monthly cashback cap',
    ]);
    expect(
      getConfirmedUpgradeBenefits({
        ...data,
        yieldBoostPercentage: 2.1,
        yieldBoostCap: 123,
        subscriptionCategoryLimit: 2,
      }),
    ).toContain('Yield boost payouts capped at $123');
  });
});
