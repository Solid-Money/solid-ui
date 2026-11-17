import { getAccountNonce } from 'permissionless/actions';
import { Address } from 'viem';
import { entryPoint07Abi, entryPoint07Address } from 'viem/account-abstraction';
import { fuse } from 'viem/chains';

import { upgradeTierSubscription } from '@/lib/api';
import { pimlicoClient } from '@/lib/pimlico';
import { isNoPaymentInTransaction, upgradeRejectionMessage } from '@/lib/upgradeRejection';
import { withRefreshToken } from '@/lib/utils';
import { publicClient } from '@/lib/wagmi';
import {
  PendingTierUpgrade,
  pendingTierUpgradeKey,
  pendingTierUpgradesFor,
  usePendingTierUpgradeStore,
} from '@/store/usePendingTierUpgradeStore';

import type { RewardsTier, TierMembershipState } from '@/lib/types';
import type { UserOperationReceipt } from 'viem/account-abstraction';

/**
 * How long an upgrade the bundler accepted, and has no receipt for, is waited
 * on before anything else is asked about it. A user operation is mined within
 * a few blocks or dropped — the same reasoning, and the same figure, as
 * `PENDING_TIER_LOCK_TTL_MS`.
 *
 * Past it, the record is settled by its nonce — see `settleUnreceipted`.
 *
 * A record missing its sender, nonce or block goes on this alone, and is let
 * go once past it. No released build writes one: all three were added before
 * this feature shipped, and every record is now written with them before
 * anything is signed. Only a development build of the feature can have left
 * one, and with nothing to settle it by, letting it go beats holding that
 * account up for good.
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
   * one of the two can ever be included. Its record — `upgrade`, as kept
   * under `key` — stays, marked `replaceable`, until that nonce is used.
   */
  | { status: 'replaceable'; key: string; upgrade: PendingTierUpgrade; nonce: bigint };

/** viem's "the bundler has no receipt for this hash (yet)". */
const isReceiptNotFound = (error: unknown): boolean => {
  for (let e = error as { name?: string; cause?: unknown } | undefined; e; ) {
    if (e.name === 'UserOperationReceiptNotFoundError') return true;
    e = e.cause as typeof e;
  }
  return false;
};

/**
 * Where a new upgrade payment starts, read before anything is signed: the
 * latest block, then the nonce it is to be sent with.
 *
 * In that order, so that whatever uses the nonce — unused when it was read —
 * is included at or after the block, and a search of the chain from there
 * finds it. The payment is sent with exactly this nonce, not one read again
 * while sending, so the record written with it stands for what is sent.
 */
export const readTierUpgradeStart = async (
  sender: Address,
): Promise<{ block: string; nonce: bigint }> => {
  const client = publicClient(fuse.id);
  const block = await client.getBlockNumber();
  const nonce = await getAccountNonce(client, {
    address: sender,
    entryPointAddress: entryPoint07Address,
  });
  return { block: block.toString(), nonce };
};

/** What an upgrade the bundler has no receipt for turned out to be. */
type Unreceipted =
  /** It may still land, or it is too soon to ask. */
  | { outcome: 'wait' }
  /** Nothing it stands for landed, and nothing ever can. */
  | { outcome: 'forget' }
  /** It has not landed, and a new payment sent with `nonce` may replace it. */
  | { outcome: 'replace'; nonce: bigint }
  /**
   * Its nonce was used by an operation that succeeded, found on the chain, and
   * taken for the one of its operations that pays for `tier`. `unmatched` when
   * it is none of those with a hash — see `PendingTierUpgrade.unmatched`.
   */
  | {
      outcome: 'landed';
      userOpHash: `0x${string}`;
      tier: RewardsTier;
      transactionHash: `0x${string}`;
      unmatched: boolean;
    };

/**
 * The operation that used `nonce` on `sender`, read off the chain: the
 * EntryPoint's `UserOperationEvent`s for the Safe from `fromBlock`, matched on
 * the nonce each carries. Undefined when there is none; throws when the search
 * fails, which says nothing either way.
 *
 * Searched by the Safe rather than by the hashes on record: the operation that
 * used the nonce may be one whose hash never arrived, or not this upgrade's at
 * all. The chain rather than the bundler, whose receipt lookup answers only
 * for a hash, and only while it remembers it.
 */
const findOperationWithNonce = async (sender: Address, nonce: bigint, fromBlock: bigint) => {
  const events = await publicClient(fuse.id).getContractEvents({
    address: entryPoint07Address,
    abi: entryPoint07Abi,
    eventName: 'UserOperationEvent',
    args: { sender },
    fromBlock,
    toBlock: 'latest',
  });
  const event = events.find(({ args }) => args.nonce === nonce);
  if (!event) return undefined;

  const { userOpHash, success } = event.args;
  if (!userOpHash || success === undefined || !event.transactionHash) {
    throw new Error('Unreadable UserOperationEvent');
  }
  return { userOpHash, success, transactionHash: event.transactionHash };
};

/**
 * What to do with an upgrade the bundler has no receipt for, or whose latest
 * operation has no hash to ask about. Throws when the chain or the bundler
 * cannot be asked, which says nothing either way.
 *
 * The operation carries no expiry of ours, so time alone never settles it —
 * an upgrade forgotten while it can still land is a payment that reaches the
 * treasury with nothing left to confirm it, and the next press pays again.
 * What does settle it is the Safe's nonce, which every operation that may
 * pay for it was sent with:
 *
 * - Moved past it: exactly one operation used it, and nothing else sent with
 *   it can ever be included. That one is found on the chain. Reverted, it
 *   moved nothing. Succeeded, and one of the record's operations, it is the
 *   payment, confirmed as the tier that one paid for. None of them, with
 *   every one of them hashed, it is another operation of the Safe's, and
 *   nothing was paid. None of the hashed ones, with one that has no hash — a
 *   send whose answer was lost — it may be that one: it is confirmed as that
 *   one's tier, and the backend says whether it holds a payment at all. Not
 *   found — the chain read from a node behind the one that read the nonce —
 *   it waits, and is looked for again on the next press.
 * - Not moved: it can still land. It waits until the bundler says it no
 *   longer has it — never seen, dropped, or failed — or, failing that, for
 *   `PENDING_TIER_UPGRADE_MAX_HOLD_MS` from when it was sent, the bound on how
 *   long a bundler that keeps saying "still queued", or a lookup that keeps
 *   failing, holds the user up. Then it may be replaced — never forgotten: a
 *   new payment goes out with this same unused nonce, so the two cannot both
 *   land, and the record keeps this operation until the nonce says which did.
 *   With no hash there is no bundler to ask, and it may be replaced at once:
 *   a bundler that does hold it turns the replacement away, and the record
 *   stays as it was.
 *
 * An operation with a hash is not asked about inside
 * `PENDING_TIER_UPGRADE_TTL_MS`: a receipt can take that long, and the answer
 * there is always to wait.
 */
const settleUnreceipted = async (
  upgrade: PendingTierUpgrade,
  now: number,
): Promise<Unreceipted> => {
  const age = now - upgrade.submittedAt;
  if (!upgrade.sender || upgrade.nonce === undefined || upgrade.block === undefined) {
    return age > PENDING_TIER_UPGRADE_TTL_MS ? { outcome: 'forget' } : { outcome: 'wait' };
  }
  if (upgrade.userOpHash && age <= PENDING_TIER_UPGRADE_TTL_MS) return { outcome: 'wait' };
  const sender = upgrade.sender as Address;
  const nonce = BigInt(upgrade.nonce);

  const current = await getAccountNonce(publicClient(fuse.id), {
    address: sender,
    entryPointAddress: entryPoint07Address,
  });
  if (current > nonce) {
    const used = await findOperationWithNonce(sender, nonce, BigInt(upgrade.block));
    if (!used) return { outcome: 'wait' };
    if (!used.success) return { outcome: 'forget' };

    // Newest first: of several with no hash, the latest is the likeliest to
    // have been accepted, since a bundler holding an earlier one turns its
    // replacement away.
    const operations = [
      { userOpHash: upgrade.userOpHash, tier: upgrade.tier },
      ...(upgrade.replaced ?? []),
    ];
    const hash = used.userOpHash.toLowerCase();
    const matched = operations.find(({ userOpHash }) => userOpHash?.toLowerCase() === hash);
    const taken = matched ?? operations.find(({ userOpHash }) => !userOpHash);
    if (!taken) return { outcome: 'forget' };
    return {
      outcome: 'landed',
      userOpHash: used.userOpHash,
      tier: taken.tier,
      transactionHash: used.transactionHash,
      unmatched: !matched,
    };
  }

  // The bound, ahead of the bundler so that a lookup which keeps failing
  // cannot stretch it.
  if (!upgrade.userOpHash || age > PENDING_TIER_UPGRADE_MAX_HOLD_MS) {
    return { outcome: 'replace', nonce };
  }
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
 * An upgrade that reverted, or whose nonce went to an operation that paid
 * nothing for it, is dropped — no money moved. One that landed is confirmed
 * with the hash it landed under, so the payment already made is the one the
 * membership is started from. One that has not landed and is past waiting for
 * answers `replaceable`, and the caller may pay again only with its nonce.
 * Anything still unsettled — including one with no receipt that may yet land
 * — answers `pending`, and the caller must not pay again.
 *
 * Never throws.
 */
export const settlePendingTierUpgrades = async (
  userId: string,
  now: number = Date.now(),
): Promise<PendingTierUpgradeSettlement> => {
  const { landed, rejected, markReplaceable, replace, forget } =
    usePendingTierUpgradeStore.getState();

  for (let { key, upgrade } of pendingTierUpgradesFor(userId)) {
    if (upgrade.rejectedAt && now - upgrade.rejectedAt > REJECTED_TIER_UPGRADE_HOLD_MS) {
      forget(key);
      continue;
    }

    if (!upgrade.transactionHash) {
      // The bundler's receipt for the latest operation, while it has a hash:
      // the quick answer, before the nonce is read at all.
      let receipt: UserOperationReceipt | undefined;
      if (upgrade.userOpHash) {
        try {
          receipt = await pimlicoClient(fuse.id).getUserOperationReceipt({
            hash: upgrade.userOpHash,
          });
        } catch (error) {
          if (!isReceiptNotFound(error)) return { status: 'pending' };
        }
      }

      if (receipt) {
        if (!receipt.success) {
          forget(key);
          continue;
        }
        landed(key, receipt.receipt.transactionHash);
        upgrade = { ...upgrade, transactionHash: receipt.receipt.transactionHash };
      } else {
        // A failed lookup of the nonce, the chain or the status is as
        // uninformative as a failed receipt lookup: it stays pending.
        const found = await settleUnreceipted(upgrade, now).catch(
          (): Unreceipted => ({ outcome: 'wait' }),
        );
        if (found.outcome === 'wait') return { status: 'pending' };
        if (found.outcome === 'replace') {
          markReplaceable(key);
          return {
            status: 'replaceable',
            key,
            upgrade: { ...upgrade, replaceable: true },
            nonce: found.nonce,
          };
        }
        if (found.outcome === 'forget') {
          forget(key);
          continue;
        }
        // Narrowed to the operation that used the nonce — possibly one this
        // replaced, or one whose hash never arrived — so it is confirmed as
        // the tier that one paid for.
        const settled: PendingTierUpgrade = {
          ...upgrade,
          userOpHash: found.userOpHash,
          tier: found.tier,
          transactionHash: found.transactionHash,
          unmatched: found.unmatched || undefined,
          replaced: undefined,
          replaceable: undefined,
        };
        replace(key, settled);
        key = pendingTierUpgradeKey(settled);
        upgrade = settled;
      }
    }

    const { tier, transactionHash } = upgrade;

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
      forget(key);
      return { status: 'confirmed', state };
    } catch (error) {
      // Only the endpoint's own answer can settle the payment for good; any
      // other failure leaves it pending, to be confirmed on the next press.
      if (error !== upgradeError) return { status: 'pending' };
      // The nonce went to an operation not known to be this payment, and the
      // backend finds no payment from the wallet in it: another operation of
      // the Safe's used the nonce, so nothing was paid for the upgrade, and
      // nothing sent for it can land now. Not a refusal — there is no money
      // at the treasury to hold against a new payment.
      if (upgrade.unmatched && (await isNoPaymentInTransaction(error))) {
        forget(key);
        continue;
      }
      const message = await upgradeRejectionMessage(error);
      if (!message) return { status: 'pending' };
      rejected(key, now);
      return { status: 'rejected', message };
    }
  }

  return { status: 'none' };
};
