import { getAccountNonce } from 'permissionless/actions';
import { Address } from 'viem';
import { entryPoint07Address } from 'viem/account-abstraction';
import { fuse } from 'viem/chains';

import { upgradeTierSubscription } from '@/lib/api';
import { pimlicoClient } from '@/lib/pimlico';
import { upgradeRejectionMessage } from '@/lib/upgradeRejection';
import { withRefreshToken } from '@/lib/utils';
import { publicClient } from '@/lib/wagmi';
import {
  PendingTierUpgrade,
  pendingTierUpgradesFor,
  usePendingTierUpgradeStore,
} from '@/store/usePendingTierUpgradeStore';

import type { TierMembershipState } from '@/lib/types';
import type { UserOperationReceipt } from 'viem/account-abstraction';

/**
 * How long an upgrade with no receipt is waited on before anything else is
 * asked about it. A user operation is mined within a few blocks or dropped —
 * the same reasoning, and the same figure, as `PENDING_TIER_LOCK_TTL_MS`.
 *
 * Past it, the record goes only once the operation provably cannot land — see
 * `canForgetUnreceipted`. A record from before the nonce was kept goes on this
 * alone, as every record used to.
 */
export const PENDING_TIER_UPGRADE_TTL_MS = 15 * 60 * 1000;

/**
 * The longest an upgrade that may still land holds up a new one.
 *
 * Its nonce unused and the bundler still holding it, or unable to say, the
 * operation could in principle still be included, and letting go of its record
 * is what would let it land unconfirmed. But a record kept for good blocks the
 * user from upgrading for good, on the word of a bundler that may simply be
 * wrong. A day is a long way past the minutes a bundler takes to include or
 * drop an operation, and the same figure support gets for a refused payment
 * (`REJECTED_TIER_UPGRADE_HOLD_MS`).
 */
export const PENDING_TIER_UPGRADE_MAX_HOLD_MS = 24 * 60 * 60 * 1000;

/**
 * What Pimlico answers for an operation it no longer has and will not include:
 * never seen or since forgotten, dropped from its mempool, or a bundle that
 * failed. Anything else — still queued, submitted, or included since the
 * receipt was asked for — means it may yet land.
 */
const BUNDLER_DROPPED_STATUSES: readonly string[] = ['not_found', 'rejected', 'failed'];

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
 * Whether an upgrade the bundler has no receipt for can be let go of: whether
 * it is known that it will never land. Throws when the chain or the bundler
 * cannot be asked, which says nothing either way.
 *
 * The operation carries no expiry of ours, so time alone never settles it —
 * an upgrade forgotten while it can still land is a payment that reaches the
 * treasury with nothing left to confirm it, and the next press pays again.
 * What does settle it is the Safe's nonce:
 *
 * - Moved past the one it was sent with: nothing sent with that nonce can be
 *   included any more, and the bundler has no receipt for this one, so it was
 *   not — the receipt is what decides that, as it always has. It goes.
 * - Not moved: it can still land. It is kept until the bundler says it no
 *   longer has it — never seen, dropped, or failed — or, failing that, for
 *   `PENDING_TIER_UPGRADE_MAX_HOLD_MS` from when it was sent, the bound on how
 *   long a bundler that keeps saying "still queued", or a lookup that keeps
 *   failing, holds the user up. A new payment made after that is sent with
 *   this same unused nonce, so the two cannot both land.
 *
 * Nothing is asked inside `PENDING_TIER_UPGRADE_TTL_MS`: a receipt can take
 * that long, and the answer there is always to wait. A record with no nonce,
 * from before one was kept, goes once past it, as every record used to.
 */
const canForgetUnreceipted = async (upgrade: PendingTierUpgrade, now: number): Promise<boolean> => {
  const age = now - upgrade.submittedAt;
  if (age <= PENDING_TIER_UPGRADE_TTL_MS) return false;
  if (upgrade.nonce === undefined || !upgrade.sender) return true;
  // The bound, ahead of any lookup so that one which keeps failing cannot
  // stretch it. Moved or not, the nonce would answer the same past it.
  if (age > PENDING_TIER_UPGRADE_MAX_HOLD_MS) return true;

  const current = await getAccountNonce(publicClient(fuse.id), {
    address: upgrade.sender as Address,
    entryPointAddress: entryPoint07Address,
  });
  if (current > BigInt(upgrade.nonce)) return true;

  const { status } = await pimlicoClient(fuse.id).getUserOperationStatus({
    hash: upgrade.userOpHash,
  });
  return BUNDLER_DROPPED_STATUSES.includes(status);
};

/**
 * Finish whatever earlier `transfer`-mode upgrade this account sent, before a
 * new one can be signed.
 *
 * An upgrade that reverted, or that can no longer land and has no receipt, is
 * dropped — no money moved. One that landed is confirmed with the hash it
 * landed under, so the payment already made is the one the membership is
 * started from. Anything still unsettled — including one with no receipt that
 * may yet land — answers `pending`, and the caller must not pay again.
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
        // A failed lookup of the nonce or the status is as uninformative as a
        // failed receipt lookup: it stays pending.
        if (
          isReceiptNotFound(error) &&
          (await canForgetUnreceipted(upgrade, now).catch(() => false))
        ) {
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
