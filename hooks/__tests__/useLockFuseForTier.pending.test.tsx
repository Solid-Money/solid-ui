import React from 'react';

import { useLockFuseForTier } from '@/hooks/useTierMembership';
import { UserCopyError } from '@/lib/errors/UserCopyError';
import { RewardsTier } from '@/lib/types';
import { usePendingTierLockStore } from '@/store/usePendingTierLockStore';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { act, create } = require('react-test-renderer');

type MutationFn = (variables: Record<string, unknown>) => Promise<unknown>;
let mockMutationFn: MutationFn | undefined;
jest.mock('@tanstack/react-query', () => ({
  useQuery: () => ({}),
  useQueryClient: () => ({ invalidateQueries: jest.fn() }),
  useMutation: (options: { mutationFn: MutationFn }) => {
    mockMutationFn = options.mutationFn;
    return {};
  },
}));
jest.mock('viem', () => ({ erc20Abi: [], encodeFunctionData: jest.fn(), formatUnits: jest.fn() }));
jest.mock('viem/chains', () => ({ fuse: { id: 122 } }));
jest.mock('@/hooks/useUser', () => ({
  __esModule: true,
  default: () => ({
    user: { userId: 'user-1', suborgId: 'suborg', signWith: '0xwallet' },
    safeAA: jest.fn().mockResolvedValue({}),
  }),
}));
const mockTrack = jest.fn();
jest.mock('@/lib/analytics', () => ({ track: (...args: unknown[]) => mockTrack(...args) }));
const mockConfirmTierLock = jest.fn();
jest.mock('@/lib/api', () => ({
  confirmTierLock: (body: unknown) => mockConfirmTierLock(body),
}));
jest.mock('@/lib/config', () => ({ ADDRESSES: { fuse: {} } }));
jest.mock('@/lib/errors', () => ({
  ...jest.requireActual('@/lib/errors/UserCopyError'),
  getUserErrorMessage: () => 'Check the details and try again.',
  sanitizeTechnicalMessage: () => 'Sanitized error',
}));
const mockExecuteTransactions = jest.fn();
jest.mock('@/lib/execute', () => ({
  USER_CANCELLED_TRANSACTION: 'cancelled',
  executeTransactions: (...args: unknown[]) => mockExecuteTransactions(...args),
}));
const mockReconcile = jest.fn();
const mockRelease = jest.fn();
jest.mock('@/lib/pendingTierLocks', () => ({
  holdPendingTierLock: jest.fn(),
  releasePendingTierLock: (hash: string) => mockRelease(hash),
  isReceiptTimeout: (error: Error) => error.name === 'WaitForUserOperationReceiptTimeoutError',
  reconcilePendingTierLocks: (userId: string) => mockReconcile(userId),
}));
jest.mock('@/lib/mmvkStorage', () => {
  const memory = new Map<string, string>();
  return {
    __esModule: true,
    default: () => ({
      setItem: (key: string, value: string) => memory.set(key, value),
      getItem: (key: string) => memory.get(key) ?? null,
      removeItem: (key: string) => memory.delete(key),
    }),
  };
});
jest.mock('@/lib/tierLockTransactions', () => ({ buildLockTransactions: () => [] }));
jest.mock('@/lib/wagmi', () => ({}));
jest.mock('@/lib/utils', () => ({}));
jest.mock('@/store/useUserStore', () => ({}));
jest.mock('@/store/useRewardsUpgradeStore', () => ({}));

const HASH = '0x9418d2b5cd787c8accc4fa1d2a0844f0808c0945a1c8885dd33c9e4d8ce1a1f1';
const TX = '0x616c8066046af09a5054d4eb060eb8e30a9c8b30e0892399daa175da3aadaeab';

const VARIABLES = {
  tier: RewardsTier.PRIME,
  asset: 'FUSE',
  fuseAmount: 50_000,
  rate: 1n,
  lockAddress: '0xlock',
  shareTokenAddress: '0xshare',
  zapAddress: '0xzap',
};

const timeout = () =>
  Object.assign(
    new Error(`Timed out while waiting for User Operation with hash "${HASH}" to be confirmed.`),
    { name: 'WaitForUserOperationReceiptTimeoutError' },
  );

/** The bundler accepted the operation, then `then` happened. */
const sendsThen = (then: () => unknown) =>
  mockExecuteTransactions.mockImplementation(
    async (
      _client: unknown,
      _calls: unknown,
      _message: string,
      _chain: unknown,
      onUserOpHash: (hash: string) => void,
    ) => {
      onUserOpHash(HASH);
      return then();
    },
  );

const stored = () => Object.keys(usePendingTierLockStore.getState().locks);

const Probe = () => {
  useLockFuseForTier();
  return null;
};

const lockFuse = () => {
  let tree: { unmount: () => void } | undefined;
  act(() => {
    tree = create(<Probe />);
  });
  act(() => tree?.unmount());
  return mockMutationFn!(VARIABLES);
};

/**
 * What a lock resolves to when it was sent but not seen through.
 *
 * The user this was found on locked 50,000 FUSE, backgrounded the app during
 * the receipt wait, came back to "failed", and pressed Lock again. The lock had
 * landed 13 seconds after the first press; the backend never heard of it.
 */
describe('a tier lock that is sent but not seen through', () => {
  beforeEach(() => {
    usePendingTierLockStore.setState({ locks: {} });
    mockExecuteTransactions.mockReset();
    mockConfirmTierLock.mockReset().mockResolvedValue({ lock: {} });
    mockReconcile.mockReset().mockResolvedValue([]);
    mockRelease.mockReset();
    mockTrack.mockReset();
  });

  it('is pending, not failed, when only the receipt wait gave up', async () => {
    sendsThen(() => {
      throw timeout();
    });

    await expect(lockFuse()).resolves.toEqual({ status: 'pending' });

    // Kept for the reconciler, and handed over to it.
    expect(stored()).toEqual([HASH]);
    expect(mockRelease).toHaveBeenCalledWith(HASH);
    expect(mockConfirmTierLock).not.toHaveBeenCalled();
    expect(mockTrack).toHaveBeenCalledWith(
      'tier_lock_pending',
      expect.objectContaining({ user_op_hash: HASH }),
    );
  });

  it('confirms a lock that landed, and forgets it', async () => {
    sendsThen(() => ({ transaction: {}, userOpHash: HASH, transactionHash: TX }));

    await expect(lockFuse()).resolves.toEqual(
      expect.objectContaining({ status: 'locked', transactionHash: TX }),
    );

    expect(mockConfirmTierLock).toHaveBeenCalledWith({ transactionHash: TX });
    expect(stored()).toEqual([]);
  });

  it('is pending when the lock landed but the confirm failed', async () => {
    sendsThen(() => ({ transaction: {}, userOpHash: HASH, transactionHash: TX }));
    mockConfirmTierLock.mockRejectedValue(new Error('502'));

    await expect(lockFuse()).resolves.toEqual({ status: 'pending' });
    expect(stored()).toEqual([HASH]);
  });

  it('still fails on anything else, and leaves the record to be settled', async () => {
    sendsThen(() => {
      throw new Error('Failed to lock your FUSE');
    });

    await expect(lockFuse()).rejects.toThrow('Failed to lock your FUSE');
    expect(stored()).toEqual([HASH]);
  });

  describe('pressing Lock again', () => {
    beforeEach(() => {
      usePendingTierLockStore.getState().remember({
        userOpHash: HASH,
        userId: 'user-1',
        submittedAt: Date.now(),
        tier: RewardsTier.PRIME,
        fuseAmount: 50_000,
        asset: 'FUSE',
      });
    });

    it('signs nothing when the earlier lock turns out to have landed', async () => {
      mockReconcile.mockImplementation(async () => {
        usePendingTierLockStore.getState().forget(HASH);
        return [{ outcome: 'confirmed' }];
      });

      await expect(lockFuse()).resolves.toEqual({ status: 'already-locked' });
      expect(mockExecuteTransactions).not.toHaveBeenCalled();
    });

    it('is refused while the earlier lock is still confirming', async () => {
      mockReconcile.mockResolvedValue([{ outcome: 'pending' }]);

      await expect(lockFuse()).rejects.toBeInstanceOf(UserCopyError);
      expect(mockExecuteTransactions).not.toHaveBeenCalled();
    });

    it('goes ahead once the earlier lock is known to have reverted', async () => {
      mockReconcile.mockImplementation(async () => {
        usePendingTierLockStore.getState().forget(HASH);
        return [{ outcome: 'reverted' }];
      });
      mockExecuteTransactions.mockResolvedValue({
        transaction: {},
        userOpHash: HASH,
        transactionHash: TX,
      });

      await expect(lockFuse()).resolves.toEqual(expect.objectContaining({ status: 'locked' }));
    });
  });
});
