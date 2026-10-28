import React, { useEffect } from 'react';

import { useRainRealTimeFunding } from '@/hooks/useRainRealTimeFunding';
import { useLockFuseForTier, useSubscribeToTier } from '@/hooks/useTierMembership';
import { UserCopyError } from '@/lib/errors/UserCopyError';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { act, create } = require('react-test-renderer');
const mockHandlers: { onError: (error: Error) => void }[] = [];
jest.mock('@tanstack/react-query', () => ({
  useQuery: () => ({}),
  useQueryClient: () => ({ invalidateQueries: jest.fn() }),
  useMutation: (options: { onError: (error: Error) => void }) => {
    mockHandlers.push(options);
    return {};
  },
}));
jest.mock('viem', () => ({ erc20Abi: [], encodeFunctionData: jest.fn(), formatUnits: jest.fn() }));
jest.mock('viem/chains', () => ({ fuse: { id: 122 } }));
jest.mock('@/hooks/useUser', () => ({ __esModule: true, default: () => ({}) }));
jest.mock('@/hooks/useCardProvider', () => ({ useCardProvider: () => ({ provider: 'rain' }) }));
jest.mock('@/lib/analytics', () => ({ track: jest.fn() }));
jest.mock('@/lib/api', () => ({}));
jest.mock('@/lib/config', () => ({ ADDRESSES: { fuse: {} } }));
jest.mock('@/lib/errors', () => ({
  ...jest.requireActual('@/lib/errors/UserCopyError'),
  getUserErrorMessage: () => 'Check the details and try again.',
  sanitizeTechnicalMessage: () => 'Sanitized error',
}));
jest.mock('@/lib/execute', () => ({ USER_CANCELLED_TRANSACTION: 'cancelled' }));
jest.mock('@/lib/pendingTierLocks', () => ({}));
jest.mock('@/lib/tierLockTransactions', () => ({}));
jest.mock('@/lib/wagmi', () => ({}));
jest.mock('@/lib/utils', () => ({}));
jest.mock('@/store/useUserStore', () => ({}));
jest.mock('@/store/useRewardsUpgradeStore', () => ({}));
jest.mock('@/store/usePendingTierLockStore', () => ({}));

let errors: (string | null | undefined)[];
const Probe = () => {
  const funding = useRainRealTimeFunding();
  const lock = useLockFuseForTier();
  const subscription = useSubscribeToTier();
  useEffect(() => {
    errors = [funding.error, lock.error, subscription.error];
  });
  return null;
};

it.each(['funding', 'lock', 'subscription'])(
  'preserves complete %s recovery copy and still sanitizes provider errors',
  flow => {
    mockHandlers.length = 0;
    let tree: any;
    act(() => {
      tree = create(<Probe />);
    });
    const index = ['funding', 'lock', 'subscription'].indexOf(flow);
    const handler = mockHandlers[index];
    const copy = `${'This network is not yet available in this installed version. '.repeat(3)}Please update the app and try again.`;
    act(() => handler.onError(new UserCopyError(copy)));
    expect(errors[index]).toBe(copy);
    act(() => handler.onError(new Error('Internal provider stack trace and credentials')));
    expect(errors[index]).toBe('Check the details and try again.');
    act(() => tree.unmount());
  },
);
