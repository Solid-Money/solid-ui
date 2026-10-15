import { useEffect } from 'react';
import { AppState } from 'react-native';

import { useInvalidateAfterUpgrade } from '@/hooks/useTierMembership';
import { reconcilePendingTierLocks } from '@/lib/pendingTierLocks';
import { usePendingTierLockStore } from '@/store/usePendingTierLockStore';

/**
 * How often a pending lock is looked up while the app is open.
 *
 * Long enough that a lock still in the mempool is not hammered, short enough
 * that someone watching the rewards screen sees the tier arrive within a
 * block or few of it landing.
 */
const RECONCILE_INTERVAL_MS = 20_000;

/**
 * Finishes the tier locks this account sent but never confirmed.
 *
 * The lock flow confirms a lock only once it has its receipt, and the receipt
 * wait does not survive the app being backgrounded: the user came back to a
 * timeout, and the backend was never told. This picks those locks up — on
 * launch, every time the app returns to the foreground, and on an interval
 * while any are pending — and does the confirm the flow could not.
 *
 * Mounted once, for the signed-in account. Does nothing at all when nothing is
 * pending, which is almost always.
 */
export const usePendingTierLockReconciler = (userId: string | undefined) => {
  const hasPending = usePendingTierLockStore(state =>
    userId ? Object.values(state.locks).some(lock => lock.userId === userId) : false,
  );
  const invalidate = useInvalidateAfterUpgrade();

  useEffect(() => {
    if (!userId || !hasPending) return;

    const run = () => {
      void reconcilePendingTierLocks(userId).then(results => {
        // A confirmed lock is a tier purchase landing, however late: the same
        // refresh the lock flow does on success, so the tier and the
        // "You're on Prime now!" card show up.
        if (results.some(({ outcome }) => outcome === 'confirmed')) {
          invalidate({ purchased: true });
        }
      });
    };

    run();
    const interval = setInterval(() => {
      if (AppState.currentState === 'active') run();
    }, RECONCILE_INTERVAL_MS);
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') run();
    });

    return () => {
      clearInterval(interval);
      subscription.remove();
    };
  }, [userId, hasPending, invalidate]);
};
