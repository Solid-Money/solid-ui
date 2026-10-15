import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import mmkvStorage from '@/lib/mmvkStorage';

import type { LockPaymentAsset } from '@/lib/tierLockPayment';
import type { RewardsTier } from '@/lib/types';

/**
 * A tier lock that was sent but not yet confirmed to the backend.
 *
 * Recorded the moment the user operation is accepted, and kept until the
 * backend has been told it landed — or until it is known that it never will.
 * That gap is where a lock used to go missing: the app waits for the receipt
 * and only then confirms, and a phone backgrounded during the wait came back
 * to a timeout, a "failed" message, and a lock nobody had recorded.
 */
export interface PendingTierLock {
  userOpHash: `0x${string}`;
  /** Whose lock it is — only that account's session may confirm it. */
  userId: string;
  /** When it was sent, ms since epoch. */
  submittedAt: number;
  tier: RewardsTier;
  fuseAmount: number;
  asset: LockPaymentAsset;
}

interface PendingTierLockState {
  /** By user operation hash. */
  locks: Record<string, PendingTierLock>;
  remember: (lock: PendingTierLock) => void;
  forget: (userOpHash: string) => void;
}

const PENDING_TIER_LOCK_STORAGE_KEY = 'pending-tier-lock-storage';

/**
 * Persisted, so the lock survives the app being killed in the background and
 * is finished on the next launch rather than forgotten with the process.
 */
export const usePendingTierLockStore = create<PendingTierLockState>()(
  persist(
    set => ({
      locks: {},
      remember: lock => set(state => ({ locks: { ...state.locks, [lock.userOpHash]: lock } })),
      forget: userOpHash =>
        set(state => {
          if (!state.locks[userOpHash]) return state;
          const { [userOpHash]: _forgotten, ...locks } = state.locks;
          return { locks };
        }),
    }),
    {
      name: PENDING_TIER_LOCK_STORAGE_KEY,
      storage: createJSONStorage(() => mmkvStorage(PENDING_TIER_LOCK_STORAGE_KEY)),
    },
  ),
);

/** One account's unconfirmed locks, oldest first. */
export const pendingTierLocksFor = (userId: string): PendingTierLock[] =>
  Object.values(usePendingTierLockStore.getState().locks)
    .filter(lock => lock.userId === userId)
    .sort((a, b) => a.submittedAt - b.submittedAt);
