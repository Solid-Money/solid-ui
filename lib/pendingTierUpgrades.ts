import { fuse } from 'viem/chains';

import { upgradeTierSubscription } from '@/lib/api';
import { pimlicoClient } from '@/lib/pimlico';
import { upgradeRejectionMessage } from '@/lib/upgradeRejection';
import { withRefreshToken } from '@/lib/utils';
import {
  pendingTierUpgradesFor,
  usePendingTierUpgradeStore,
} from '@/store/usePendingTierUpgradeStore';

import type { TierMembershipState } from '@/lib/types';
import type { UserOperationReceipt } from 'viem/account-abstraction';

/**
 * How long an upgrade the bundler has never heard of is kept. A user operation
 * is mined within a few blocks or dropped — the same reasoning, and the same
 * figure, as `PENDING_TIER_LOCK_TTL_MS`.
 */
export const PENDING_TIER_UPGRADE_TTL_MS = 15 * 60 * 1000;

export { upgradeRejectionMessage };

/**
 * How long a payment the backend refused is still held against a new one.
 *
 * A refusal after the money landed (below the price, already a member) is
 * final, and support is alerted to refund or fix it. Until they have had time
 * to, a new press shows the refusal again rather than paying a second time;
 * after this, the record is let go so a refunded user can buy again.
 */
export const REJECTED_TIER_UPGRADE_HOLD_MS = 24 * 60 * 60 * 1000;

/** What an earlier upgrade turned out to be when it was settled. */
export type PendingTierUpgradeSettlement =
  /** Nothing earlier is outstanding: a new upgrade may be signed. */
  | { status: 'none' }
  /** An earlier upgrade had landed and is now confirmed. Nothing new is needed. */
  | { status: 'confirmed'; state: TierMembershipState }
  /** An earlier upgrade may still land, or landed and is not yet confirmed. Do not pay again. */
  | { status: 'pending' }
  /** An earlier upgrade landed and the backend refused it for good. Show why; do not pay again. */
  | { status: 'rejected'; message: string };

/** viem's "the bundler has no receipt for this hash (yet)". */
const isReceiptNotFound = (error: unknown): boolean => {
  for (let e = error as { name?: string; cause?: unknown } | undefined; e; ) {
    if (e.name === 'UserOperationReceiptNotFoundError') return true;
    e = e.cause as typeof e;
  }
  return false;
};

/**
 * Finish whatever earlier `transfer`-mode upgrade this account sent, before a
 * new one can be signed.
 *
 * An upgrade that reverted, or that the bundler never saw, is dropped — no
 * money moved. One that landed is confirmed with the hash it landed under, so
 * the payment already made is the one the membership is started from. Anything
 * still unsettled answers `pending`, and the caller must not pay again.
 *
 * Never throws.
 */
export const settlePendingTierUpgrades = async (
  userId: string,
  now: number = Date.now(),
): Promise<PendingTierUpgradeSettlement> => {
  const { landed, rejected, forget } = usePendingTierUpgradeStore.getState();

  for (const upgrade of pendingTierUpgradesFor(userId)) {
    if (upgrade.rejectedAt && now - upgrade.rejectedAt > REJECTED_TIER_UPGRADE_HOLD_MS) {
      forget(upgrade.userOpHash);
      continue;
    }

    let transactionHash = upgrade.transactionHash;

    if (!transactionHash) {
      let receipt: UserOperationReceipt;
      try {
        receipt = await pimlicoClient(fuse.id).getUserOperationReceipt({
          hash: upgrade.userOpHash,
        });
      } catch (error) {
        if (isReceiptNotFound(error) && now - upgrade.submittedAt > PENDING_TIER_UPGRADE_TTL_MS) {
          forget(upgrade.userOpHash);
          continue;
        }
        return { status: 'pending' };
      }

      if (!receipt.success) {
        forget(upgrade.userOpHash);
        continue;
      }
      transactionHash = receipt.receipt.transactionHash;
      landed(upgrade.userOpHash, transactionHash);
    }

    // What the upgrade endpoint itself last threw. `withRefreshToken` can also
    // throw the session refresh's own error after a 401 — a 404 from the
    // refresh endpoint, say — and that says nothing about this payment.
    let upgradeError: unknown;
    try {
      const state = await withRefreshToken(async () => {
        try {
          return await upgradeTierSubscription({
            tier: upgrade.tier,
            transactionHash: transactionHash!,
          });
        } catch (error) {
          upgradeError = error;
          throw error;
        }
      });
      forget(upgrade.userOpHash);
      return { status: 'confirmed', state };
    } catch (error) {
      // Only the endpoint's own answer can refuse the payment for good; any
      // other failure leaves it pending, to be confirmed on the next press.
      const message = error === upgradeError ? await upgradeRejectionMessage(error) : null;
      if (!message) return { status: 'pending' };
      rejected(upgrade.userOpHash, now);
      return { status: 'rejected', message };
    }
  }

  return { status: 'none' };
};
