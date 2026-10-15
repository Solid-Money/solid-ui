import { fuse } from 'viem/chains';

import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { track } from '@/lib/analytics';
import { confirmTierLock } from '@/lib/api';
import { toUserError } from '@/lib/errors';
import { pimlicoClient } from '@/lib/pimlico';
import { withRefreshToken } from '@/lib/utils';
import {
  PendingTierLock,
  pendingTierLocksFor,
  usePendingTierLockStore,
} from '@/store/usePendingTierLockStore';
import { selectedRewardsUserId } from '@/store/useRewardsUpgradeStore';

import type { UserOperationReceipt } from 'viem/account-abstraction';

/**
 * How long a lock the bundler has never heard of is kept before it is given up
 * on.
 *
 * A user operation is either mined within a few blocks or dropped from the
 * mempool, and Fuse makes a block every ~5s — a quarter of an hour without a
 * receipt is not a slow lock, it is one that is not coming. Giving up only
 * stops the app asking: a lock that somehow lands later is still recorded by
 * the backend, which sees every transfer into the lock contract.
 */
export const PENDING_TIER_LOCK_TTL_MS = 15 * 60 * 1000;

/** What became of a pending lock when it was looked up. */
export type PendingTierLockOutcome =
  /** Landed, and the backend has been told. */
  | 'confirmed'
  /** Landed and reverted: nothing was locked. */
  | 'reverted'
  /** Never seen by the bundler within the TTL. */
  | 'expired'
  /** Not settled yet — not mined, or a lookup or the confirm failed. Kept. */
  | 'pending';

/**
 * Whether a lock failed only because the app stopped waiting for it.
 *
 * The user operation was sent and may well land — it usually already has — so
 * this must never read as a failed upgrade, or the user does what the person
 * this was found on did: presses Lock again.
 */
export const isReceiptTimeout = (error: unknown): boolean =>
  toUserError(error).code === 'RECEIPT_TIMEOUT';

/** viem's "the bundler has no receipt for this hash (yet)". */
const isReceiptNotFound = (error: unknown): boolean => {
  for (let e = error as { name?: string; cause?: unknown } | undefined; e; ) {
    if (e.name === 'UserOperationReceiptNotFoundError') return true;
    e = e.cause as typeof e;
  }
  return false;
};

/**
 * Locks something is already seeing through — a run of the reconciler, or the
 * lock flow still waiting on its own receipt — so nothing confirms one twice.
 */
const inFlight = new Set<string>();

/**
 * Keep the reconciler off a lock while the flow that sent it is still waiting
 * for its receipt. That flow confirms it itself when the wait succeeds; the
 * reconciler takes over only once it lets go.
 */
export const holdPendingTierLock = (userOpHash: string) => {
  inFlight.add(userOpHash);
};

export const releasePendingTierLock = (userOpHash: string) => {
  inFlight.delete(userOpHash);
};

/**
 * Look up one pending lock and finish it if it landed.
 *
 * Confirming is the same call the lock flow makes after its receipt: it is
 * what records the lock for the automatic return and drops the cached
 * position so the new tier shows.
 */
const settle = async (lock: PendingTierLock, now: number): Promise<PendingTierLockOutcome> => {
  const { forget } = usePendingTierLockStore.getState();

  let receipt: UserOperationReceipt;
  try {
    receipt = await pimlicoClient(fuse.id).getUserOperationReceipt({ hash: lock.userOpHash });
  } catch (error) {
    if (isReceiptNotFound(error) && now - lock.submittedAt > PENDING_TIER_LOCK_TTL_MS) {
      forget(lock.userOpHash);
      return 'expired';
    }
    // Not mined yet, or the bundler could not be reached: ask again later.
    return 'pending';
  }

  if (!receipt.success) {
    forget(lock.userOpHash);
    return 'reverted';
  }

  let confirmed: boolean;
  try {
    confirmed = await withRefreshToken(async () => {
      // The confirm goes out under whichever account is selected at this
      // moment, and the backend records the lock against that account. A run
      // that started for this lock's owner and outlived a switch must not
      // confirm it as someone else — it is left for the owner's next session.
      // Checked here, right before the request, because the receipt lookup and
      // the token refresh above both wait long enough for a switch to happen.
      if (selectedRewardsUserId() !== lock.userId) return false;
      await confirmTierLock({ transactionHash: receipt.receipt.transactionHash });
      return true;
    });
  } catch {
    // Landed but not yet confirmed. Kept, so the next run tries again.
    return 'pending';
  }
  if (!confirmed) return 'pending';

  forget(lock.userOpHash);
  return 'confirmed';
};

/**
 * Finish every lock this account sent but never confirmed.
 *
 * Runs on launch, whenever the app comes back to the foreground, and on a
 * short interval while anything is pending — see
 * `usePendingTierLockReconciler`. Also run by the lock flow itself before a
 * new lock, so a second press cannot lock the same FUSE twice while the first
 * is still landing.
 *
 * Sequential and never throws: every failure leaves the lock where it was for
 * the next run.
 */
export const reconcilePendingTierLocks = async (
  userId: string,
): Promise<{ lock: PendingTierLock; outcome: PendingTierLockOutcome }[]> => {
  const results: { lock: PendingTierLock; outcome: PendingTierLockOutcome }[] = [];

  for (const lock of pendingTierLocksFor(userId)) {
    if (inFlight.has(lock.userOpHash)) continue;
    inFlight.add(lock.userOpHash);

    try {
      const outcome = await settle(lock, Date.now());
      results.push({ lock, outcome });

      if (outcome !== 'pending') {
        track(TRACKING_EVENTS.TIER_LOCK_RECONCILED, {
          outcome,
          tier: lock.tier,
          fuse_amount: lock.fuseAmount,
          asset: lock.asset,
          user_op_hash: lock.userOpHash,
          waited_ms: Date.now() - lock.submittedAt,
        });
      }
    } finally {
      inFlight.delete(lock.userOpHash);
    }
  }

  return results;
};
