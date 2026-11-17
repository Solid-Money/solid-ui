import { fuse } from 'viem/chains';

import { upgradeTierSubscription } from '@/lib/api';
import { pimlicoClient } from '@/lib/pimlico';
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

/** What an earlier upgrade turned out to be when it was settled. */
export type PendingTierUpgradeSettlement =
  /** Nothing earlier is outstanding: a new upgrade may be signed. */
  | { status: 'none' }
  /** An earlier upgrade had landed and is now confirmed. Nothing new is needed. */
  | { status: 'confirmed'; state: TierMembershipState }
  /** An earlier upgrade may still land, or landed and is not yet confirmed. Do not pay again. */
  | { status: 'pending' };

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
  const { landed, forget } = usePendingTierUpgradeStore.getState();

  for (const upgrade of pendingTierUpgradesFor(userId)) {
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

    try {
      const state = await withRefreshToken(() =>
        upgradeTierSubscription({ tier: upgrade.tier, transactionHash: transactionHash! }),
      );
      forget(upgrade.userOpHash);
      return { status: 'confirmed', state };
    } catch {
      return { status: 'pending' };
    }
  }

  return { status: 'none' };
};
