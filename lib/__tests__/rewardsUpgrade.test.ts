import { getTierAction, isHigherTier } from '@/lib/rewardsUpgrade';
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
