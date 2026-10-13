import { QueryClient } from '@tanstack/react-query';

import { refreshRewardsAfterSavings } from '@/lib/refreshRewardsAfterSavings';
import {
  REWARDS_UPGRADE_CLEARED_STATE,
  useRewardsUpgradeStore,
} from '@/store/useRewardsUpgradeStore';

jest.mock('@/store/useUserStore', () => {
  // Jest factories resolve mocks before ES imports.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { create } = require('zustand');
  return { useUserStore: create(() => ({ users: [{ userId: 'a', selected: true }] })) };
});

beforeEach(() => {
  useRewardsUpgradeStore.setState({ userId: 'a', session: 0, ...REWARDS_UPGRADE_CLEARED_STATE });
});

/**
 * A yield-boost claim or a savings deposit cannot raise a tier, so it must not
 * open the window that waits for one — that window only ever ran out, and the
 * benefits screen then said no higher tier had been confirmed.
 */
it('refetches the rewards payload without waiting for a promotion', () => {
  const queryClient = new QueryClient();
  const invalidate = jest.spyOn(queryClient, 'invalidateQueries').mockResolvedValue();

  refreshRewardsAfterSavings(queryClient, 'a', '0xSafe');

  expect(invalidate).toHaveBeenCalledWith({ queryKey: ['rewards', 'userData', 'a'] });
  expect(useRewardsUpgradeStore.getState().pendingUntil).toBeUndefined();
});

it('ignores an account that is no longer selected', () => {
  const queryClient = new QueryClient();
  const invalidate = jest.spyOn(queryClient, 'invalidateQueries').mockResolvedValue();

  refreshRewardsAfterSavings(queryClient, 'b');

  expect(invalidate).not.toHaveBeenCalled();
});
