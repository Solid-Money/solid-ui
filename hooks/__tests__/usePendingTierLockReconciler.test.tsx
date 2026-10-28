import React from 'react';
import { AppState, AppStateStatus } from 'react-native';

import { usePendingTierLockReconciler } from '@/hooks/usePendingTierLockReconciler';
import { RewardsTier } from '@/lib/types';
import { usePendingTierLockStore } from '@/store/usePendingTierLockStore';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { act, create } = require('react-test-renderer');

const mockInvalidate = jest.fn();
jest.mock('@/hooks/useTierMembership', () => ({
  useInvalidateAfterUpgrade: () => mockInvalidate,
}));
const mockReconcile = jest.fn();
jest.mock('@/lib/pendingTierLocks', () => ({
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

const HASH = '0x9418d2b5cd787c8accc4fa1d2a0844f0808c0945a1c8885dd33c9e4d8ce1a1f1';
const listeners = new Set<(state: AppStateStatus) => void>();

const Probe = ({ userId }: { userId?: string }) => {
  usePendingTierLockReconciler(userId);
  return null;
};

/** Settle the promise chain a run kicks off. */
const flush = () => act(async () => {});

describe('finishing pending tier locks in the background', () => {
  let renderer: { update: (el: React.ReactElement) => void; unmount: () => void } | undefined;

  const mount = async (userId?: string) => {
    await act(async () => {
      renderer = create(<Probe userId={userId} />);
    });
  };

  beforeEach(() => {
    mockInvalidate.mockReset();
    mockReconcile.mockReset().mockResolvedValue([]);
    listeners.clear();
    Object.assign(AppState, { currentState: 'active' });
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, listener) => {
      listeners.add(listener);
      return { remove: () => listeners.delete(listener) } as never;
    });
    usePendingTierLockStore.setState({
      locks: {
        [HASH]: {
          userOpHash: HASH,
          userId: 'user-1',
          submittedAt: Date.now(),
          tier: RewardsTier.PRIME,
          fuseAmount: 50_000,
          asset: 'FUSE',
        },
      },
    });
  });

  afterEach(() => {
    act(() => renderer?.unmount());
    renderer = undefined;
    jest.restoreAllMocks();
  });

  it('refreshes the tier once a pending lock is confirmed', async () => {
    mockReconcile.mockResolvedValue([{ outcome: 'confirmed' }]);

    await mount('user-1');
    await flush();

    expect(mockReconcile).toHaveBeenCalledWith('user-1');
    expect(mockInvalidate).toHaveBeenCalledWith({ purchased: true });
  });

  it('refreshes nothing while the lock is still pending', async () => {
    mockReconcile.mockResolvedValue([{ outcome: 'pending' }]);

    await mount('user-1');
    await flush();

    expect(mockInvalidate).not.toHaveBeenCalled();
  });

  it('stays idle for an account with nothing pending', async () => {
    await mount('user-2');

    expect(mockReconcile).not.toHaveBeenCalled();
  });

  it('looks again when the app returns to the foreground', async () => {
    await mount('user-1');
    await flush();
    mockReconcile.mockClear();

    await act(async () => {
      listeners.forEach(listener => listener('active'));
    });

    expect(mockReconcile).toHaveBeenCalledTimes(1);
  });

  /**
   * A run still in flight when the account switches must not refresh: the
   * refresh arms the upgrade card for whichever account is selected by then.
   */
  it('ignores a run that finishes after the account switched', async () => {
    let finish: (results: { outcome: string }[]) => void = () => {};
    mockReconcile.mockReturnValue(
      new Promise(resolve => {
        finish = resolve;
      }),
    );

    await mount('user-1');
    await act(async () => {
      renderer?.update(<Probe userId="user-2" />);
    });
    await act(async () => {
      finish([{ outcome: 'confirmed' }]);
    });

    expect(mockInvalidate).not.toHaveBeenCalled();
  });
});
