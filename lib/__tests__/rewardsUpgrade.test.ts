import { getTierAction, isHigherTier, isUpgradeFlowRoute } from '@/lib/rewardsUpgrade';
import { RewardsTier } from '@/lib/types';

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
});

describe('isUpgradeFlowRoute', () => {
  it('covers both screens that buy a tier, trailing slash or not', () => {
    expect(isUpgradeFlowRoute('/rewards/upgrade')).toBe(true);
    expect(isUpgradeFlowRoute('/rewards/upgrade-review')).toBe(true);
    expect(isUpgradeFlowRoute('/rewards/upgrade/')).toBe(true);
  });

  /** Where the celebration is supposed to land. */
  it('leaves the rewards screen itself alone', () => {
    expect(isUpgradeFlowRoute('/rewards')).toBe(false);
    expect(isUpgradeFlowRoute('/rewards/benefits')).toBe(false);
  });

  it('draws everywhere else, including before the router has a path', () => {
    expect(isUpgradeFlowRoute('/')).toBe(false);
    expect(isUpgradeFlowRoute('/savings')).toBe(false);
    expect(isUpgradeFlowRoute(undefined)).toBe(false);
    expect(isUpgradeFlowRoute(null)).toBe(false);
  });
});
