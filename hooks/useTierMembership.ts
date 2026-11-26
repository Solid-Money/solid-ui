import { useCallback, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Address, erc20Abi, formatUnits } from 'viem';
import { fuse } from 'viem/chains';

import { TRACKING_EVENTS } from '@/constants/tracking-events';
import useUser from '@/hooks/useUser';
import { SolidSubscriptionModule_ABI } from '@/lib/abis/SolidSubscriptionModule';
import { track } from '@/lib/analytics';
import {
  cancelTierSubscription,
  confirmTierLock,
  confirmTierSubscription,
  fetchTierMembership,
  resumeTierSubscription,
  upgradeTierSubscription,
} from '@/lib/api';
import { ADDRESSES } from '@/lib/config';
import { getUserErrorMessage, sanitizeTechnicalMessage, UserCopyError } from '@/lib/errors';
import { executeTransactions, USER_CANCELLED_TRANSACTION } from '@/lib/execute';
import {
  holdPendingTierLock,
  isReceiptTimeout,
  reconcilePendingTierLocks,
  releasePendingTierLock,
} from '@/lib/pendingTierLocks';
import { readTierUpgradeStart, settlePendingTierUpgrades } from '@/lib/pendingTierUpgrades';
import { buildLockTransactions } from '@/lib/tierLockTransactions';
import {
  BILLING_DECIMALS,
  buildSubscriptionTransactions,
  usdToBillingUnits,
} from '@/lib/tierSubscriptionTransactions';
import {
  offerFirstYearFeeUsd,
  offerMandateUsd,
  offerPaymentMode,
  TIER_MEMBERSHIP_PAYMENT_MODES,
} from '@/lib/tierUpgrade';
import { RewardsTier, TierMembershipContracts, TierMembershipState, TierOffer } from '@/lib/types';
import { upgradeRejectionMessage } from '@/lib/upgradeRejection';
import { withRefreshToken } from '@/lib/utils';
import { publicClient } from '@/lib/wagmi';
import { pendingTierLocksFor, usePendingTierLockStore } from '@/store/usePendingTierLockStore';
import {
  PendingTierUpgrade,
  pendingTierUpgradeKey,
  TierUpgradePayment,
  usePendingTierUpgradeStore,
} from '@/store/usePendingTierUpgradeStore';
import { selectedRewardsUserId, useRewardsUpgradeStore } from '@/store/useRewardsUpgradeStore';
import { useUserStore } from '@/store/useUserStore';

import type { LockPaymentAsset } from '@/lib/tierLockPayment';

export const TIER_MEMBERSHIP_QUERY_KEY = 'tierMembership';
export /**
 * How often the upgrade screen re-reads the Safe's balances.
 *
 * Five seconds: a Fuse block is ~5s, so this is roughly one read per block —
 * fast enough that a deposit landing while the user watches flips the CTA
 * within a block or two, and slow enough not to hammer the node from a screen
 * someone may leave open.
 */
const BALANCE_POLL_MS = 5_000;

const TIER_UPGRADE_BALANCES_QUERY_KEY = 'tierUpgradeBalances';

/** soFUSE shares, the accountant rate and the share token all use 18 decimals. */
const SHARE_DECIMALS = 18;

/** What the upgrade screens need from the chain, read fresh at the moment of use. */
export interface TierUpgradeChainState {
  /** soFUSE shares the Safe holds, raw. */
  shares: bigint;
  /** That position in FUSE. */
  fuse: number;
  /** Native FUSE the Safe holds. */
  nativeFuse: number;
  /** WFUSE the Safe holds. Par with native FUSE, so it reads as the same unit. */
  wrappedFuse: number;
  /** soFUSE→FUSE rate, raw (18 decimals). */
  rate: bigint;
  /** USDC the Safe holds, raw (6 decimals). */
  usdc: bigint;
  /** That balance as a number, for display. */
  usdcAmount: number;
  /** Whether the subscription module is already enabled on the Safe. */
  moduleEnabled: boolean;
  /** Whether the Safe has already written a mandate. */
  hasMandate: boolean;
  /**
   * When this read was asked for, ms since epoch: taken before any of it is
   * sent, so every balance in it is at least this recent.
   *
   * Not React Query's `dataUpdatedAt`, which is when the slowest of the reads
   * came back: the USDC one can answer before a bridged payment lands and the
   * batch still finish after, and a balance judged by that would be taken as
   * including USDC it never saw. See `resolveCashPayment`.
   */
  readStartedAt: number;
}

/**
 * What each tier costs by either route, and what the user has already bought.
 *
 * Served by the backend as one payload rather than assembled here: the price,
 * the thresholds and the user's own position have to describe the same instant,
 * and three requests is how a screen ends up offering a tier the user already
 * holds.
 */
export const useTierMembership = ({
  enabled = true,
  refreshInterval,
}: { enabled?: boolean; refreshInterval?: number } = {}) => {
  const selectedUserId = useUserStore(state => state.users.find(user => user.selected)?.userId);

  return useQuery<TierMembershipState>({
    // The payment modes asked for are part of the answer — the backend offers
    // Ultra for cash only to a client that asked for `transfer` — so they are
    // part of the key, and a payload fetched without them is never read as one.
    queryKey: [TIER_MEMBERSHIP_QUERY_KEY, selectedUserId, TIER_MEMBERSHIP_PAYMENT_MODES],
    // Wrapped like the other session calls: an expired token is refreshed rather
    // than leaving the portfolio waiting on React Query's retries.
    queryFn: () => withRefreshToken(fetchTierMembership),
    enabled: enabled && Boolean(selectedUserId),
    staleTime: 30_000,
    refetchInterval: refreshInterval,
  });
};

/**
 * The chain state an upgrade is actually built from.
 *
 * Read directly rather than taken from the backend for the same reason
 * `useCardSpendRegistration` does it: the module's consent and the Safe's
 * balances are on-chain facts a user can change from any Safe client with no
 * call to us, and a screen that offers to spend money has to be reading the
 * chain, not a cache of it.
 */
export const useTierUpgradeChainState = (contracts?: {
  lockAddress: string | null;
  subscriptionModuleAddress: string | null;
  shareTokenAddress: string | null;
  wrappedNativeAddress: string | null;
  billingTokenAddress: string | null;
}) => {
  const { user } = useUser();
  const safeAddress = user?.safeAddress as Address | undefined;
  const shareToken = (contracts?.shareTokenAddress ?? ADDRESSES.fuse.fuseVault) as Address;
  const billingToken = contracts?.billingTokenAddress as Address | undefined;
  const moduleAddress = contracts?.subscriptionModuleAddress as Address | undefined;
  const wrappedNative = contracts?.wrappedNativeAddress as Address | undefined;

  return useQuery<TierUpgradeChainState>({
    queryKey: [
      TIER_UPGRADE_BALANCES_QUERY_KEY,
      safeAddress,
      shareToken,
      billingToken,
      moduleAddress,
      wrappedNative,
    ],
    enabled: Boolean(safeAddress),
    // Polled, not cached-and-forgotten. This drives the difference between
    // "Top up" and "Review upgrade", and the top-up it sends the user to
    // settles somewhere else entirely — a savings deposit or the deposit
    // drawer — so nothing invalidates this on the way back. Without a poll the
    // screen kept showing the pre-deposit balance, and the CTA stayed "Top up"
    // with the FUSE already sitting in the Safe.
    //
    // `staleTime` is under the interval so a remount mid-flow refetches rather
    // than serving the balance the user is standing there watching for.
    staleTime: BALANCE_POLL_MS / 2,
    refetchInterval: BALANCE_POLL_MS,
    // The interesting case is the user coming back from topping up, which is
    // exactly a remount or a refocus.
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const readStartedAt = Date.now();
      const client = publicClient(fuse.id);

      // All of them in flight together: this drives a screen that has to price
      // an offer against a balance, and fetching them in sequence is how the
      // two end up describing different moments.
      const [shares, rate, usdc, moduleEnabled, subscription, native, wrapped] = await Promise.all([
        client.readContract({
          address: shareToken,
          abi: erc20Abi,
          functionName: 'balanceOf',
          args: [safeAddress!],
        }),
        client.readContract({
          address: ADDRESSES.fuse.fuseAccountant,
          abi: [
            {
              inputs: [],
              name: 'getRate',
              outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
              stateMutability: 'view',
              type: 'function',
            },
          ] as const,
          functionName: 'getRate',
        }),
        billingToken
          ? client.readContract({
              address: billingToken,
              abi: erc20Abi,
              functionName: 'balanceOf',
              args: [safeAddress!],
            })
          : Promise.resolve(0n),
        moduleAddress
          ? client.readContract({
              address: moduleAddress,
              abi: SolidSubscriptionModule_ABI,
              functionName: 'isModuleEnabledOn',
              args: [safeAddress!],
            })
          : Promise.resolve(false),
        moduleAddress
          ? client.readContract({
              address: moduleAddress,
              abi: SolidSubscriptionModule_ABI,
              functionName: 'subscriptionOf',
              args: [safeAddress!],
            })
          : Promise.resolve(undefined),
        // Both read whether or not the zap is deployed. They cost one multicall
        // slot each, and a balance the screen does not know about is a "Top up"
        // button in front of a user who is holding the FUSE.
        client.getBalance({ address: safeAddress! }),
        wrappedNative
          ? client.readContract({
              address: wrappedNative,
              abi: erc20Abi,
              functionName: 'balanceOf',
              args: [safeAddress!],
            })
          : Promise.resolve(0n),
      ]);

      return {
        shares,
        // Shares are yield-bearing, so a raw balance understates the position —
        // it has to go through the accountant rate to read as FUSE.
        fuse: Number(formatUnits((shares * rate) / 10n ** BigInt(SHARE_DECIMALS), SHARE_DECIMALS)),
        // Native FUSE and WFUSE are the same unit as the FUSE a tier is priced
        // in — the wrapper holds exactly its own total supply — so neither
        // needs the rate.
        nativeFuse: Number(formatUnits(native, SHARE_DECIMALS)),
        wrappedFuse: Number(formatUnits(wrapped, SHARE_DECIMALS)),
        rate,
        usdc,
        usdcAmount: Number(formatUnits(usdc, BILLING_DECIMALS)),
        moduleEnabled,
        hasMandate: subscription?.registered === true && subscription.cancelledAt === 0n,
        readStartedAt,
      };
    },
  });
};

/** Everything a membership change invalidates, in one place so no path forgets one. */
export const useInvalidateAfterUpgrade = () => {
  const queryClient = useQueryClient();

  return useCallback(
    ({ purchased }: { purchased: boolean }) => {
      queryClient.invalidateQueries({ queryKey: [TIER_MEMBERSHIP_QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: [TIER_UPGRADE_BALANCES_QUERY_KEY] });
      // The tier itself has moved, so anything describing it is stale — the
      // rewards screen, the benefits table, the fees the user is quoted. Same key
      // shape `refreshRewardsAfterSavings` invalidates, minus the user id, so one
      // upgrade refreshes whichever account is selected.
      queryClient.invalidateQueries({ queryKey: ['rewards', 'userData'] });

      // A purchase also opens the reconciliation window, which is what actually
      // gets the "You're on Prime now!" card shown.
      //
      // `RewardsUpgradeFeedback` celebrates a tier it sees *rise* between two
      // reads of the rewards payload. One invalidation gives it a single read,
      // taken the instant the transaction lands — before the backend has
      // re-derived the tier from a lock it has not indexed yet, or a
      // subscription row written in the same breath. That read returns the old
      // tier, nothing appears to have risen, and the upgrade the user just paid
      // for is never acknowledged. Arming the window makes it poll until the new
      // tier arrives.
      //
      // Cancelling or resuming a membership raises nothing, so it has nothing to
      // wait for.
      if (!purchased) return;
      const userId = selectedRewardsUserId();
      if (userId) useRewardsUpgradeStore.getState().tierPurchased(userId);
    },
    [queryClient],
  );
};

/**
 * Lock to hold a tier, paying with whatever the user has.
 *
 * soFUSE, native FUSE or WFUSE — all three priced in FUSE, because that is the
 * unit a tier threshold is measured in. Which one is chosen is decided by
 * `chooseLockPayment`; what each one costs in calls is decided by
 * `buildLockTransactions`.
 *
 * Always one user operation. For soFUSE that is approve-then-lock, batched so
 * neither half can land without the other — an approval left standing with no
 * lock behind it is a permission the user did not mean to leave lying around.
 * For FUSE and WFUSE it is the zap, which deposits and locks in one call so the
 * user no longer has to fund Savings, wait for the shares, and come back.
 *
 * Resolves to null when the passkey prompt is dismissed, and otherwise to a
 * `status`: `locked` once the lock has landed and the backend knows;
 * `pending` when it was sent but not seen through — the receipt wait gave up,
 * usually because the app was backgrounded, or the confirm failed — which the
 * screen must not present as a failure, because pressing Lock again is the
 * one wrong move; and `already-locked` when an earlier lock that had been left
 * pending turned out to have landed, so nothing new was signed. Pending locks
 * are finished by `usePendingTierLockReconciler`.
 */
export const useLockFuseForTier = () => {
  const { user, safeAA } = useUser();
  const invalidate = useInvalidateAfterUpgrade();
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async ({
      tier,
      asset,
      fuseAmount,
      rate,
      lockAddress,
      shareTokenAddress,
      zapAddress,
      wrappedNativeAddress,
    }: {
      tier: RewardsTier;
      /** What is paying for the lock. */
      asset: LockPaymentAsset;
      /** FUSE the user is committing. */
      fuseAmount: number;
      /** soFUSE→FUSE rate, raw. */
      rate: bigint;
      lockAddress: string;
      shareTokenAddress: string;
      /** `SolidTierLockZap`. Required for anything that is not already soFUSE. */
      zapAddress?: string | null;
      /** WFUSE. Required to pay with WFUSE. */
      wrappedNativeAddress?: string | null;
    }) => {
      if (!user?.suborgId || !user?.signWith) {
        throw new UserCopyError('Your wallet is still setting up. Please try again shortly.');
      }
      const userId = user.userId;

      // A lock sent earlier that was never confirmed may have landed, or may
      // still land. Settled before anything new is signed: this screen was
      // priced before that lock counted, so a second one now would commit the
      // same FUSE twice — which is what pressing Lock again after a "failed"
      // timeout used to risk.
      const earlier = await reconcilePendingTierLocks(userId);
      if (earlier.some(({ outcome }) => outcome === 'confirmed')) {
        return { status: 'already-locked' as const };
      }
      if (pendingTierLocksFor(userId).length > 0) {
        throw new UserCopyError(
          'Your last lock is still confirming. Your membership updates as soon as it lands — there is no need to lock again.',
        );
      }

      const transactions = buildLockTransactions({
        asset,
        fuseAmount,
        rate,
        lockAddress: lockAddress as Address,
        shareTokenAddress: shareTokenAddress as Address,
        zapAddress: (zapAddress as Address) || undefined,
        wrappedNativeAddress: (wrappedNativeAddress as Address) || undefined,
      });

      const smartAccountClient = await safeAA(fuse, user.suborgId, user.signWith);

      // Remembered the moment the bundler accepts it, before any waiting: from
      // here the lock can land whatever happens to the app, and this record is
      // how it is still confirmed if the wait below does not see it through.
      let userOpHash: `0x${string}` | undefined;
      const rememberLock = (hash: `0x${string}`) => {
        userOpHash = hash;
        holdPendingTierLock(hash);
        usePendingTierLockStore.getState().remember({
          userOpHash: hash,
          userId,
          submittedAt: Date.now(),
          tier,
          fuseAmount,
          asset,
        });
      };

      try {
        let result: Awaited<ReturnType<typeof executeTransactions>>;
        try {
          result = await executeTransactions(
            smartAccountClient,
            transactions,
            'Failed to lock your FUSE',
            fuse,
            rememberLock,
          );
        } catch (lockError) {
          // Sent, and only the wait gave up — usually because the app was in
          // the background. Not a failure: the lock has most likely landed
          // already, and `usePendingTierLockReconciler` confirms it once it has.
          if (userOpHash && isReceiptTimeout(lockError)) {
            track(TRACKING_EVENTS.TIER_LOCK_PENDING, {
              tier,
              fuse_amount: fuseAmount,
              asset,
              user_op_hash: userOpHash,
            });
            return { status: 'pending' as const };
          }
          // Anything else after sending — a revert, a lost connection — is
          // shown as it always was. The record stays for the reconciler, which
          // drops it if the lock reverted and confirms it if it landed after all.
          throw lockError;
        }

        if (result === USER_CANCELLED_TRANSACTION) {
          track(TRACKING_EVENTS.TIER_LOCK_CANCELLED, { tier, fuse_amount: fuseAmount, asset });
          return null;
        }

        // Told to the backend afterwards, not before: the lock is already on
        // chain and the tier is already the user's. This is what drops the
        // cached position so it shows immediately, and registers them for the
        // automatic return when the term is up.
        let state: TierMembershipState;
        try {
          state = await confirmTierLock({ transactionHash: result.transactionHash });
        } catch {
          // The lock landed; only telling the backend failed. Still not a
          // failed upgrade — the record is kept and the reconciler confirms it.
          track(TRACKING_EVENTS.TIER_LOCK_PENDING, {
            tier,
            fuse_amount: fuseAmount,
            asset,
            user_op_hash: result.userOpHash,
            transaction_hash: result.transactionHash,
          });
          return { status: 'pending' as const };
        }
        usePendingTierLockStore.getState().forget(result.userOpHash);

        return {
          status: 'locked' as const,
          state,
          transactionHash: result.transactionHash,
          fuseAmount,
          tier,
          asset,
        };
      } finally {
        // Whatever happened, this flow is done waiting: anything still pending
        // is the reconciler's from here.
        if (userOpHash) releasePendingTierLock(userOpHash);
      }
    },
    onSuccess: result => {
      if (!result || result.status === 'pending') return;
      // An earlier lock that only just got confirmed is a purchase landing too.
      invalidate({ purchased: true });
      if (result.status !== 'locked') return;
      track(TRACKING_EVENTS.TIER_LOCK_COMPLETED, {
        tier: result.tier,
        fuse_amount: result.fuseAmount,
        asset: result.asset,
        transaction_hash: result.transactionHash,
      });
    },
    onError: (mutationError: Error) => {
      setError(
        mutationError instanceof UserCopyError
          ? mutationError.message
          : getUserErrorMessage(mutationError, { action: 'subscription' }) || null,
      );
      track(TRACKING_EVENTS.TIER_LOCK_FAILED, {
        error: sanitizeTechnicalMessage(mutationError) || 'Failed to lock your FUSE',
      });
    },
  });

  return {
    lockFuse: mutation.mutateAsync,
    isLocking: mutation.isPending,
    error,
    clearError: () => setError(null),
  };
};

/**
 * An upgrade paid by transfer that was sent and is still landing. Shown to the
 * user like any refusal of ours, but it is not a failed upgrade, and is not
 * reported as one.
 */
class TierUpgradeConfirmingError extends UserCopyError {}

/**
 * The bundler turning an operation away over its nonce: another is already
 * waiting with it and this one does not outbid it, or the nonce has just been
 * used. What a replacement meets while the operation it replaces is still
 * held, or has landed after all.
 */
const NONCE_REFUSAL = /\bAA25\b|invalid account nonce|nonce too low|replacement|already known/i;

/** Whether the error, or anything that caused it, says something `pattern` matches. */
const saysAnywhere = (error: unknown, pattern: RegExp): boolean => {
  for (
    let e = error as { message?: string; details?: string; cause?: unknown } | undefined;
    e;
    e = e.cause as typeof e
  ) {
    if (pattern.test(`${e.message ?? ''} ${e.details ?? ''}`)) return true;
  }
  return false;
};

const isNonceRefusal = (error: unknown): boolean => saysAnywhere(error, NONCE_REFUSAL);

/**
 * The bundler — or the paymaster or node asked while the operation was
 * prepared — turning it away: it failed validation (an EntryPoint `AAxx`
 * code, a revert in simulation) or its nonce was refused. Whatever was signed
 * was never accepted, so it can never land.
 *
 * Narrow on purpose. A send that failed any other way — a dropped connection,
 * a timeout — may have reached the bundler and been accepted with only the
 * answer lost. "Already known" is left out for the same reason: it is the
 * bundler saying it holds the operation.
 */
const REFUSED_BEFORE_ACCEPTANCE =
  /\bAA[1-9]\d\b|reverted during simulation|execution reverted|invalid account nonce|nonce too low|replacement/i;

/** A send that certainly left nothing with the bundler: refused, or stopped by our own check first. */
const refusedBeforeAcceptance = (error: unknown): boolean =>
  // Ours only before sending: the Safe cannot pay the network fee.
  error instanceof UserCopyError ||
  (saysAnywhere(error, REFUSED_BEFORE_ACCEPTANCE) && !saysAnywhere(error, /already known/i));

/** An earlier payment by transfer that a new one may only replace, as settling found it. */
type ReplaceableUpgrade = { key: string; upgrade: PendingTierUpgrade; nonce: bigint };

/** A payment by transfer, on record from before it is signed. */
interface TransferAttempt {
  /** Where its record is kept. */
  key: string;
  /** The record as written, with no hash yet. */
  record: PendingTierUpgrade;
  /** The nonce it is sent with: the one on record. */
  nonce: bigint;
}

/**
 * Put a payment by transfer on record before anything is signed, under the
 * Safe and the nonce it is then sent with: a new payment's read now, a
 * replacement's the earlier payment's own.
 *
 * From the moment the bundler may have it, a retry finds it — even when the
 * answer that carries its hash is lost, or the app stops before it arrives —
 * and whatever uses that nonce settles it. A replacement keeps the block of
 * the payment it replaces, and that payment's operations, any of which may
 * still be the one that lands.
 */
const recordTransferAttempt = async ({
  userId,
  tier,
  payment,
  safeAddress,
  replacing,
}: {
  userId: string;
  tier: RewardsTier;
  /** The transfer to the treasury the operation makes. */
  payment: TierUpgradePayment;
  safeAddress: string;
  replacing?: ReplaceableUpgrade;
}): Promise<TransferAttempt> => {
  const start = replacing
    ? { block: replacing.upgrade.block, nonce: replacing.nonce }
    : await readTierUpgradeStart(safeAddress as Address);
  const record: PendingTierUpgrade = {
    userId,
    submittedAt: Date.now(),
    tier,
    payment,
    sender: safeAddress,
    nonce: start.nonce.toString(),
    block: start.block,
    ...(replacing && {
      replaced: [
        {
          userOpHash: replacing.upgrade.userOpHash,
          tier: replacing.upgrade.tier,
          payment: replacing.upgrade.payment,
        },
        ...(replacing.upgrade.replaced ?? []),
      ],
    }),
  };
  const pending = usePendingTierUpgradeStore.getState();
  const key = pendingTierUpgradeKey(record);
  // Marked as being sent before it is written, so no screen takes it for a
  // payment to confirm while its passkey prompt is up. Cleared when the
  // attempt is over, whatever its end.
  pending.setSending(key, true);
  if (replacing) pending.replace(replacing.key, record);
  else pending.remember(record);
  return { key, record, nonce: start.nonce };
};

/**
 * Take back a payment the bundler never accepted, so the record is as it was
 * before it: nothing, or the payment it was to replace.
 */
const withdrawTransferAttempt = (attempt: TransferAttempt, replacing?: ReplaceableUpgrade) => {
  const pending = usePendingTierUpgradeStore.getState();
  if (replacing) pending.replace(attempt.key, replacing.upgrade);
  else pending.forget(attempt.key);
};

/**
 * Accounts with an upgrade by transfer under way in this app — settling an
 * earlier payment, signing a new one, or confirming it.
 *
 * The pending record is what stops a second payment, and it is only written
 * once the settlement check has found nothing and the nonce has been read: a
 * second press in between — a double tap, or another step's own copy of this
 * hook — would pass the same check, and the two would sign over each other's
 * record. Module scope, so every instance of the hook sees the same set;
 * released when the attempt is over, whatever its end.
 */
const transferUpgradesInFlight = new Set<string>();

/**
 * Buy a tier with the annual fee, the way the offer says it is paid.
 *
 * One user operation either way. For `module` — a first membership — that is
 * enable the module on the Safe, then write the mandate, and the backend takes
 * the first year through the module once it lands. Batching is what makes the
 * permission and its bounds a single decision — a Safe cannot end up with the
 * module enabled and no mandate, which would be a standing permission with
 * nothing shaping it.
 *
 * For `transfer` — an upgrade from a running membership, whose period has
 * already had its one module charge — the Safe pays the first year to the
 * treasury in the same batch, and the upgrade endpoint is told instead of the
 * confirm one. The two are never mixed: a `transfer` offer confirmed as a
 * subscription would ask the module for a charge it will refuse.
 *
 * The mandate is set to exactly the annual fee — the renewal price, not a
 * first-year sale price. A cap with headroom in it would survive a price rise
 * without asking, and asking is the point: a subscription whose price goes up
 * is a new agreement, and the user should sign it. See
 * `buildSubscriptionTransactions` for the calls.
 */
export const useSubscribeToTier = () => {
  const { user, safeAA } = useUser();
  const invalidate = useInvalidateAfterUpgrade();
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async ({
      offer,
      contracts,
      moduleEnabled,
      funding,
      confirmPendingOnly = false,
    }: {
      /** The offer being bought, exactly as the screen priced it. */
      offer: TierOffer;
      contracts: TierMembershipContracts;
      /** Whether the Safe has already enabled the module. */
      moduleEnabled: boolean;
      /**
       * The LI.FI swap that brought the USDC in, when the payment was bridged
       * from another chain. The backend reads it back and lets the first
       * charge absorb the bridge's cost. The caller marks it spent once this
       * resolves — see `markUpgradeFundingSpent`. Not sent for a `transfer`
       * upgrade, which has no bridge-fee cover.
       */
      funding?: { transactionHash: string; fromChainId: number };
      /**
       * Only finish an earlier `transfer` payment that is still unconfirmed;
       * never sign a new one. For a screen whose balance no longer covers the
       * fee — because that payment has already taken it — and so has not
       * checked that a new payment could go through. Needs neither the module,
       * the treasury nor a price on the offer: the earlier payment is
       * confirmed by its own hash, even once cash is no longer sold.
       */
      confirmPendingOnly?: boolean;
    }) => {
      if (!user?.suborgId || !user?.signWith || !user?.safeAddress) {
        throw new UserCopyError('Your wallet is still setting up. Please try again shortly.');
      }

      const { tier } = offer;
      const mode = offerPaymentMode(offer);
      const priceUsd = offerFirstYearFeeUsd(offer);
      const userId = user.userId;
      const safeAddress = user.safeAddress;
      // A transfer pays the treasury from the Safe, so an earlier one that was
      // sent and never confirmed is settled before anything new is signed —
      // finished if it landed, rather than paid for a second time. Settling is
      // also all a confirm-only press does.
      const settlesEarlier = mode === 'transfer' || confirmPendingOnly;

      // Held from the settlement check until this attempt is over, so no other
      // attempt for the account passes that check before this one's payment is
      // on record — see `transferUpgradesInFlight`.
      if (settlesEarlier) {
        if (transferUpgradesInFlight.has(userId)) {
          throw new TierUpgradeConfirmingError(
            'Your upgrade is already under way. Your membership updates as soon as it finishes — there is no need to pay again.',
          );
        }
        transferUpgradesInFlight.add(userId);
      }

      // An earlier payment that never landed, and that a new one may only
      // replace: sent with its nonce, so that only one of the two can land.
      let replacing: ReplaceableUpgrade | undefined;
      // This attempt's record, while it is being sent — see `recordTransferAttempt`.
      let sendingKey: string | undefined;

      try {
        if (settlesEarlier) {
          const earlier = await settlePendingTierUpgrades(userId);
          if (earlier.status === 'confirmed') {
            return { state: earlier.state, transactionHash: undefined, tier, priceUsd, mode };
          }
          if (earlier.status === 'rejected') {
            throw new UserCopyError(earlier.message);
          }
          if (earlier.status === 'pending') {
            throw new UserCopyError(
              'Your last upgrade payment is still confirming. Your membership updates as soon as it does — there is no need to pay again.',
            );
          }
          if (earlier.status === 'replaceable') replacing = earlier;
        }

        // There was nothing earlier left to finish, and the caller only asked
        // to confirm: a new payment is the user's next, deliberate press.
        // Settling marked one that never landed as replaceable, so the screen
        // stops waiting to confirm it and offers to pay again.
        //
        // Checked before the contracts and the price below, which only a new
        // payment needs: an earlier one is confirmed by its hash alone, and
        // has to stay confirmable when cash is switched off after it was paid.
        if (confirmPendingOnly) {
          throw new UserCopyError(
            replacing
              ? 'Your last upgrade payment didn’t go through, and no money moved. Check your balance and tap again to upgrade — you can only be charged once.'
              : 'There is no earlier payment left to confirm. Check your balance and tap again to upgrade.',
          );
        }

        if (!contracts.subscriptionModuleAddress) {
          throw new UserCopyError('Memberships are not available right now.');
        }
        const mandateUsd = offerMandateUsd(offer);
        if (priceUsd === null || mandateUsd === null) {
          throw new UserCopyError('This tier is not available with an annual fee.');
        }
        const discounted = priceUsd < mandateUsd;
        if (discounted && offer.saleEndsAt && Date.parse(offer.saleEndsAt) <= Date.now()) {
          throw new UserCopyError(
            'The sale has ended. Reopen the upgrade to see the current price.',
          );
        }

        const transactions = buildSubscriptionTransactions({
          mode,
          safeAddress: safeAddress as Address,
          moduleAddress: contracts.subscriptionModuleAddress as Address,
          moduleEnabled,
          mandateUsd,
          chargeUsd: priceUsd,
          billingTokenAddress: contracts.billingTokenAddress as Address | null,
          revenueTreasuryAddress: (contracts.revenueTreasuryAddress ?? null) as Address | null,
        });

        const smartAccountClient = await safeAA(fuse, user.suborgId, user.signWith);

        // Paid by transfer, the payment is on record before the passkey is
        // asked for — see `recordTransferAttempt`. A replacement's record
        // moves to it, and keeps the payment it replaces: until the nonce is
        // used, either may land.
        const attempt =
          mode === 'transfer'
            ? await recordTransferAttempt({
                userId,
                tier,
                // What `buildSubscriptionTransactions` has the Safe send.
                payment: {
                  token: String(contracts.billingTokenAddress),
                  to: String(contracts.revenueTreasuryAddress),
                  units: usdToBillingUnits(priceUsd).toString(),
                },
                safeAddress,
                replacing,
              })
            : undefined;
        sendingKey = attempt?.key;

        let userOpHash: `0x${string}` | undefined;
        let result: Awaited<ReturnType<typeof executeTransactions>>;
        try {
          result = await executeTransactions(
            smartAccountClient,
            transactions,
            mode === 'transfer'
              ? 'Failed to upgrade your membership'
              : 'Failed to start your membership',
            fuse,
            // The hash, the moment the bundler accepts it, and when it was
            // sent. The record is already down: this only says more about it.
            attempt
              ? hash => {
                  userOpHash = hash;
                  usePendingTierUpgradeStore
                    .getState()
                    .remember({ ...attempt.record, userOpHash: hash, submittedAt: Date.now() });
                }
              : undefined,
            undefined,
            // Sent with exactly the nonce on record: a new payment's own, or
            // the earlier payment's, as its replacement.
            attempt?.nonce,
          );
        } catch (sendError) {
          // Paid by transfer, sent, and only the wait gave up — usually because
          // the app was in the background. The payment has most likely landed:
          // the record stays, the next press confirms it, and saying "failed"
          // here is what would make the user pay again. Anything else is shown
          // as it always was; the record lets the next press settle it either
          // way.
          if (mode === 'transfer' && userOpHash && isReceiptTimeout(sendError)) {
            track(TRACKING_EVENTS.TIER_SUBSCRIBE_PENDING, {
              tier,
              price_usd: priceUsd,
              payment_mode: mode,
              user_op_hash: userOpHash,
            });
            throw new TierUpgradeConfirmingError(
              'Your upgrade payment is still confirming. Try again in a moment to finish — you won’t be charged twice.',
            );
          }
          // Turned away before the bundler accepted anything: nothing signed
          // can land, so the record goes back to what it was before this
          // payment. Any other failure before the hash arrived may be a
          // payment accepted with only the answer lost; it stays on record,
          // and the next press settles it by its nonce.
          if (attempt && !userOpHash && refusedBeforeAcceptance(sendError)) {
            withdrawTransferAttempt(attempt, replacing);
          }
          // A replacement the bundler turned away over its nonce: it still
          // holds the earlier payment, or that payment has just landed after
          // all. Nothing new was sent, and the earlier record stays for the
          // next press to settle.
          if (replacing && !userOpHash && isNonceRefusal(sendError)) {
            throw new TierUpgradeConfirmingError(
              'Your last upgrade payment is still with the network, so a new one can’t be sent yet. Try again in a little while — you won’t be charged twice.',
            );
          }
          throw sendError;
        }

        if (result === USER_CANCELLED_TRANSACTION) {
          // Dismissed — the passkey prompt, or the network fee — before the
          // bundler had anything: nothing can land, and the record is as it
          // was before this payment.
          if (attempt && !userOpHash) withdrawTransferAttempt(attempt, replacing);
          track(TRACKING_EVENTS.TIER_SUBSCRIBE_CANCELLED, { tier, price_usd: priceUsd });
          return null;
        }

        if (attempt) {
          const pending = usePendingTierUpgradeStore.getState();
          pending.landed(attempt.key, result.transactionHash);
          let state: TierMembershipState;
          try {
            state = await upgradeTierSubscription({
              tier,
              transactionHash: result.transactionHash,
            });
          } catch (error) {
            // Paid, and only telling the backend failed. The record is kept, so
            // the next press confirms this payment rather than making another —
            // or, when the backend refused it for good, shows why again.
            const message = await upgradeRejectionMessage(error);
            if (message) {
              pending.rejected(attempt.key, Date.now());
              throw new UserCopyError(message);
            }
            throw new UserCopyError(
              'Your payment went through, but your upgrade isn’t confirmed yet. Tap Upgrade again to finish — you won’t be charged twice.',
            );
          }
          pending.forget(attempt.key);
          return { state, transactionHash: result.transactionHash, tier, priceUsd, mode };
        }

        // The first payment is taken here, server-side, against the mandate
        // that has just landed. It can fail — most often for a Safe short of
        // USDC — and when it does the error carries the module's own reason.
        const state = await confirmTierSubscription({
          tier,
          transactionHash: result.transactionHash,
          ...(funding ? { funding } : {}),
        });

        return { state, transactionHash: result.transactionHash, tier, priceUsd, mode };
      } finally {
        // A record left without a hash now counts as a payment that may have
        // been made: the next press confirms it, whatever the balance says.
        if (sendingKey) usePendingTierUpgradeStore.getState().setSending(sendingKey, false);
        if (settlesEarlier) transferUpgradesInFlight.delete(userId);
      }
    },
    onSuccess: result => {
      if (!result) return;
      invalidate({ purchased: true });
      track(TRACKING_EVENTS.TIER_SUBSCRIBE_COMPLETED, {
        tier: result.tier,
        price_usd: result.priceUsd,
        payment_mode: result.mode,
        transaction_hash: result.transactionHash,
      });
    },
    onError: (mutationError: Error) => {
      setError(
        mutationError instanceof UserCopyError
          ? mutationError.message
          : getUserErrorMessage(mutationError, { action: 'subscription' }) || null,
      );
      // Tracked as pending where it was thrown.
      if (mutationError instanceof TierUpgradeConfirmingError) return;
      track(TRACKING_EVENTS.TIER_SUBSCRIBE_FAILED, {
        error: sanitizeTechnicalMessage(mutationError) || 'Failed to start your membership',
      });
    },
  });

  return {
    subscribe: mutation.mutateAsync,
    isSubscribing: mutation.isPending,
    error,
    clearError: () => setError(null),
  };
};

/**
 * Stop a membership renewing.
 *
 * Off-chain only, and that is the whole of it as far as money is concerned:
 * Solid's billing engine is the only thing that draws against the mandate, so
 * ceasing to draw ends the charges. The on-chain `cancel()` is offered
 * separately for anyone who wants the permission itself gone rather than merely
 * unused.
 */
export const useCancelTierSubscription = () => {
  const invalidate = useInvalidateAfterUpgrade();

  return useMutation({
    mutationFn: (reason?: string) => cancelTierSubscription({ reason }),
    // Its only caller fires and forgets; the global handler shows the failure.
    meta: { errorAction: 'subscription', errorTitle: 'Couldn’t cancel your plan' },
    onSuccess: subscription => {
      invalidate({ purchased: false });
      track(TRACKING_EVENTS.TIER_SUBSCRIPTION_CANCEL_COMPLETED, {
        tier: subscription.tier,
        period_end: subscription.currentPeriodEnd,
      });
    },
  });
};

/** Undo a cancellation while the paid period is still running. */
export const useResumeTierSubscription = () => {
  const invalidate = useInvalidateAfterUpgrade();

  return useMutation({
    mutationFn: () => resumeTierSubscription(),
    meta: { errorAction: 'subscription', errorTitle: 'Couldn’t resume your plan' },
    onSuccess: subscription => {
      invalidate({ purchased: false });
      track(TRACKING_EVENTS.TIER_SUBSCRIPTION_RESUME_COMPLETED, { tier: subscription.tier });
    },
  });
};
