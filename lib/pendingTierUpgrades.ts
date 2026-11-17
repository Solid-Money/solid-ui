import { getAccountNonce } from 'permissionless/actions';
import { Address } from 'viem';
import { entryPoint07Abi, entryPoint07Address } from 'viem/account-abstraction';
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

import type { RewardsTier, TierMembershipState } from '@/lib/types';
import type { UserOperationReceipt } from 'viem/account-abstraction';

/**
 * How long an upgrade with no receipt is waited on before anything else is
 * asked about it. A user operation is mined within a few blocks or dropped —
 * the same reasoning, and the same figure, as `PENDING_TIER_LOCK_TTL_MS`.
 *
 * Past it, the record is settled by its nonce — see `settleUnreceipted`. A
 * record from before the nonce was kept goes on this alone, as every record
 * used to.
 */
export const PENDING_TIER_UPGRADE_TTL_MS = 15 * 60 * 1000;

/**
 * The longest an upgrade that may still land holds up a new one.
 *
 * Its nonce unused and the bundler still holding it, or unable to say, the
 * operation could in principle still be included. Past this, a new payment
 * may go ahead anyway — but only as its replacement, sent with the same nonce,
 * so that whichever of the two is included the other never can be. The record
 * is not let go: the earlier operation may yet be the one that lands. A day is
 * a long way past the minutes a bundler takes to include or drop an operation,
 * and the same figure support gets for a refused payment
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
  | { status: 'rejected'; message: string }
  /**
   * An earlier upgrade has not landed, and a new payment may go ahead only as
   * its replacement: sent with `nonce`, the earlier one's own, so that only
   * one of the two can ever be included. Its record stays, marked
   * `replaceable`, until that nonce is used.
   */
  | { status: 'replaceable'; upgrade: PendingTierUpgrade; nonce: bigint };

/** viem's "the bundler has no receipt for this hash (yet)". */
const isReceiptNotFound = (error: unknown): boolean => {
  for (let e = error as { name?: string; cause?: unknown } | undefined; e; ) {
    if (e.name === 'UserOperationReceiptNotFoundError') return true;
    e = e.cause as typeof e;
  }
  return false;
};

/** One operation a record stands for, and the tier it pays for. */
type RecordedOperation = { userOpHash: `0x${string}`; tier: RewardsTier };

/** What an upgrade the bundler has no receipt for turned out to be. */
type Unreceipted =
  /** It may still land, or it is too soon to ask. */
  | { outcome: 'wait' }
  /** It never landed, and never can. */
  | { outcome: 'forget' }
  /** It has not landed, and a new payment sent with `nonce` may replace it. */
  | { outcome: 'replace'; nonce: bigint }
  /** One of its operations was included — found on the chain. */
  | ({ outcome: 'landed'; transactionHash: `0x${string}`; success: boolean } & RecordedOperation);

/**
 * Which of a record's operations the EntryPoint included, if any, read off the
 * chain: the `UserOperationEvent` for any of their hashes, from the block read
 * before the first of them was sent. Throws when the search fails, which says
 * nothing either way.
 *
 * The chain rather than the bundler, whose receipt lookup answers for the
 * operations it still remembers, and whose "not found" is what is being
 * second-guessed here.
 */
const findIncluded = async (
  upgrade: PendingTierUpgrade,
): Promise<Extract<Unreceipted, { outcome: 'landed' }> | undefined> => {
  const operations: RecordedOperation[] = [
    { userOpHash: upgrade.userOpHash, tier: upgrade.tier },
    ...(upgrade.replaced ?? []),
  ];
  const [event] = await publicClient(fuse.id).getContractEvents({
    address: entryPoint07Address,
    abi: entryPoint07Abi,
    eventName: 'UserOperationEvent',
    args: { userOpHash: operations.map(operation => operation.userOpHash) },
    // A record from before the block was kept is searched for from the start
    // of the chain: a wider search, but one that still finds the operation or
    // positively does not.
    fromBlock: upgrade.block === undefined ? 0n : BigInt(upgrade.block),
    toBlock: 'latest',
  });
  if (!event) return undefined;

  const hash = event.args.userOpHash?.toLowerCase();
  const operation = operations.find(({ userOpHash }) => userOpHash.toLowerCase() === hash);
  if (!operation || !event.transactionHash || event.args.success === undefined) {
    throw new Error('Unreadable UserOperationEvent');
  }
  return {
    outcome: 'landed',
    ...operation,
    transactionHash: event.transactionHash,
    success: event.args.success,
  };
};

/**
 * What to do with an upgrade the bundler has no receipt for. Throws when the
 * chain or the bundler cannot be asked, which says nothing either way.
 *
 * The operation carries no expiry of ours, so time alone never settles it —
 * an upgrade forgotten while it can still land is a payment that reaches the
 * treasury with nothing left to confirm it, and the next press pays again.
 * What does settle it is the Safe's nonce:
 *
 * - Moved past the one it was sent with: nothing sent with that nonce can be
 *   included any more. But it may have been this upgrade that used it — in
 *   the moment between the receipt lookup and the nonce read, say — so the
 *   nonce alone proves nothing about the payment. The chain is asked again,
 *   after the read: if one of the record's operations is found, it landed,
 *   and is confirmed or dropped on its own success flag; if none is, none
 *   ever will be, and it goes.
 * - Not moved: it can still land. It waits until the bundler says it no
 *   longer has it — never seen, dropped, or failed — or, failing that, for
 *   `PENDING_TIER_UPGRADE_MAX_HOLD_MS` from when it was sent, the bound on how
 *   long a bundler that keeps saying "still queued", or a lookup that keeps
 *   failing, holds the user up. Then it may be replaced — never forgotten: a
 *   new payment goes out with this same unused nonce, so the two cannot both
 *   land, and the record keeps this operation until the nonce says which did.
 *
 * Nothing is asked inside `PENDING_TIER_UPGRADE_TTL_MS`: a receipt can take
 * that long, and the answer there is always to wait. A record with no nonce,
 * from before one was kept, goes once past it, as every record used to.
 */
const settleUnreceipted = async (
  upgrade: PendingTierUpgrade,
  now: number,
): Promise<Unreceipted> => {
  const age = now - upgrade.submittedAt;
  if (age <= PENDING_TIER_UPGRADE_TTL_MS) return { outcome: 'wait' };
  if (upgrade.nonce === undefined || !upgrade.sender) return { outcome: 'forget' };
  const nonce = BigInt(upgrade.nonce);

  const current = await getAccountNonce(publicClient(fuse.id), {
    address: upgrade.sender as Address,
    entryPointAddress: entryPoint07Address,
  });
  if (current > nonce) return (await findIncluded(upgrade)) ?? { outcome: 'forget' };

  // The bound, ahead of the bundler so that a lookup which keeps failing
  // cannot stretch it.
  if (age > PENDING_TIER_UPGRADE_MAX_HOLD_MS) return { outcome: 'replace', nonce };
  const { status } = await pimlicoClient(fuse.id).getUserOperationStatus({
    hash: upgrade.userOpHash,
  });
  return BUNDLER_DROPPED_STATUSES.includes(status)
    ? { outcome: 'replace', nonce }
    : { outcome: 'wait' };
};

/**
 * Finish whatever earlier `transfer`-mode upgrade this account sent, before a
 * new one can be signed.
 *
 * An upgrade that reverted, or that can no longer land and has no receipt, is
 * dropped — no money moved. One that landed is confirmed with the hash it
 * landed under, so the payment already made is the one the membership is
 * started from. One that has not landed and is past waiting for answers
 * `replaceable`, and the caller may pay again only with its nonce. Anything
 * still unsettled — including one with no receipt that may yet land — answers
 * `pending`, and the caller must not pay again.
 *
 * Never throws.
 */
export const settlePendingTierUpgrades = async (
  userId: string,
  now: number = Date.now(),
): Promise<PendingTierUpgradeSettlement> => {
  const { landed, rejected, markReplaceable, replace, forget } =
    usePendingTierUpgradeStore.getState();

  for (let upgrade of pendingTierUpgradesFor(userId)) {
    if (upgrade.rejectedAt && now - upgrade.rejectedAt > REJECTED_TIER_UPGRADE_HOLD_MS) {
      forget(upgrade.userOpHash);
      continue;
    }

    if (!upgrade.transactionHash) {
      let receipt: UserOperationReceipt | undefined;
      try {
        receipt = await pimlicoClient(fuse.id).getUserOperationReceipt({
          hash: upgrade.userOpHash,
        });
      } catch (error) {
        if (!isReceiptNotFound(error)) return { status: 'pending' };
      }

      if (receipt) {
        if (!receipt.success) {
          forget(upgrade.userOpHash);
          continue;
        }
        landed(upgrade.userOpHash, receipt.receipt.transactionHash);
        upgrade = { ...upgrade, transactionHash: receipt.receipt.transactionHash };
      } else {
        // A failed lookup of the nonce, the chain or the status is as
        // uninformative as a failed receipt lookup: it stays pending.
        const found = await settleUnreceipted(upgrade, now).catch(
          (): Unreceipted => ({ outcome: 'wait' }),
        );
        if (found.outcome === 'wait') return { status: 'pending' };
        if (found.outcome === 'replace') {
          markReplaceable(upgrade.userOpHash);
          return { status: 'replaceable', upgrade, nonce: found.nonce };
        }
        if (found.outcome === 'forget' || !found.success) {
          forget(upgrade.userOpHash);
          continue;
        }
        // Narrowed to the operation that landed — possibly one this replaced —
        // so it is confirmed as the tier that one paid for.
        const settled: PendingTierUpgrade = {
          ...upgrade,
          userOpHash: found.userOpHash,
          tier: found.tier,
          transactionHash: found.transactionHash,
          replaced: undefined,
          replaceable: undefined,
        };
        replace(upgrade.userOpHash, settled);
        upgrade = settled;
      }
    }

    const { userOpHash, tier, transactionHash } = upgrade;

    // What the upgrade endpoint itself last threw. `withRefreshToken` can also
    // throw the session refresh's own error after a 401 — a 404 from the
    // refresh endpoint, say — and that says nothing about this payment.
    let upgradeError: unknown;
    try {
      const state = await withRefreshToken(async () => {
        try {
          return await upgradeTierSubscription({ tier, transactionHash: transactionHash! });
        } catch (error) {
          upgradeError = error;
          throw error;
        }
      });
      forget(userOpHash);
      return { status: 'confirmed', state };
    } catch (error) {
      // Only the endpoint's own answer can refuse the payment for good; any
      // other failure leaves it pending, to be confirmed on the next press.
      const message = error === upgradeError ? await upgradeRejectionMessage(error) : null;
      if (!message) return { status: 'pending' };
      rejected(userOpHash, now);
      return { status: 'rejected', message };
    }
  }

  return { status: 'none' };
};
