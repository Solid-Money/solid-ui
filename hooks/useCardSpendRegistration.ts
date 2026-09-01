import { useCallback, useState } from 'react';
import { QueryClient, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Address, encodeFunctionData } from 'viem';
import { fuse } from 'viem/chains';

import {
  CASH_USD_DECIMALS,
  getDeviceTimezoneOffsetSeconds,
  MONTHLY_LIMIT_MULTIPLIER,
  monthlyLimitFor,
  usdToOnChain,
} from '@/constants/cardSpendModule';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { useCardProvider } from '@/hooks/useCardProvider';
import useUser from '@/hooks/useUser';
import { Safe_ABI } from '@/lib/abis/Safe';
import { SolidCashModule_ABI } from '@/lib/abis/SolidCashModule';
import { track } from '@/lib/analytics';
import { confirmWirexCardRegistration } from '@/lib/api';
import { ADDRESSES } from '@/lib/config';
import { executeTransactions, USER_CANCELLED_TRANSACTION } from '@/lib/execute';
import { CardProvider } from '@/lib/types';
import { publicClient } from '@/lib/wagmi';
import { useUserStore } from '@/store/useUserStore';

export const CARD_SPEND_REGISTRATION_QUERY_KEY = 'cardSpendRegistration';

const MODULE = ADDRESSES.fuse.cashModule;

/**
 * Head of a Safe's module linked list. `disableModule(prevModule, module)` needs the
 * entry pointing at the one being removed, and for the most recently enabled module
 * that pointer is the sentinel itself rather than another module's address.
 */
const SENTINEL_MODULES = '0x0000000000000000000000000000000000000001' as Address;

/** Enough to cover any real Safe's module list in one read. */
const MODULE_PAGE_SIZE = 50n;

/** Where a registration or limit change was started from, for the funnel. */
export type CardSpendRegistrationSource = 'spending_sheet' | 'card_activation';

/** The Safe's live limit state, with every matured transition already applied. */
export interface CardSpendLimit {
  dailyLimitUsd: bigint;
  monthlyLimitUsd: bigint;
  spentTodayUsd: bigint;
  spentThisMonthUsd: bigint;
  /** The offset the rolling windows reset on. Written at registration, no setter. */
  timezoneOffset: number;
}

/**
 * A limit increase that has been requested but has not matured yet.
 *
 * Only ever non-null while the raise is still pending: `applicableSpendingLimit` folds a
 * matured increase into the live limits and zeroes the activation time, so this is
 * exactly "asked for, not in force".
 */
export interface PendingLimitIncrease {
  dailyLimitUsd: bigint;
  monthlyLimitUsd: bigint;
  /** Unix seconds. The increase is in force on the first block after this. */
  activatesAt: bigint;
}

/** What the setup sheet needs to render, all read from the chain in one multicall. */
export interface CardSpendRegistration {
  /** Both halves done — module enabled on the Safe *and* the Safe registered. */
  registered: boolean;
  /**
   * The raw `isRegistered` flag, kept separate from {@link registered}.
   *
   * These come apart in a state the UI has to handle: registration is permanent
   * (`registerSafe` reverts `AlreadyRegistered` and there is no deregister), but module
   * consent can be withdrawn at any time. A Safe that registered and then disabled the
   * module is `registeredOnChain` yet not `registered`, and the fix is to re-enable the
   * module — not to register again, which cannot succeed.
   */
  registeredOnChain: boolean;
  moduleEnabled: boolean;
  /** Live org ceilings. A chosen limit above either of these reverts. */
  maxDailyLimitUsd: bigint;
  maxMonthlyLimitUsd: bigint;
  defaultDailyLimitUsd: bigint;
  defaultMonthlyLimitUsd: bigint;
  /** Hard cap on one card transaction, independent of the rolling windows. */
  maxPerTxUsd: bigint;
  /** Global guardian pause — spending is off for everyone while true. */
  modulePaused: boolean;
  /** Per-Safe guardian pause: arrears or a fraud hold. */
  safePaused: boolean;
  /** This Safe's caps and what has been spent against them. Zeroed until registered. */
  limit: CardSpendLimit;
  /** A requested raise still inside its delay window, or null. */
  pendingIncrease: PendingLimitIncrease | null;
  /** How long a requested increase waits before it takes effect, in seconds. */
  limitRaiseDelaySeconds: number;
}

/**
 * One multicall for everything the spending sheet decides on.
 *
 * A standalone function rather than an inline `queryFn` so the mutations can re-read
 * through `fetchQuery` right before they sign. That matters: every write here is
 * conditional on the current state (which calls to batch, whether a change is a decrease
 * or an increase), and reading that from a render closure means signing against whatever
 * was true when the sheet last rendered.
 */
const readCardSpendRegistration = async (safeAddress: Address): Promise<CardSpendRegistration> => {
  const client = publicClient(fuse.id);
  const module = { address: MODULE as Address, abi: SolidCashModule_ABI } as const;

  // One multicall rather than eleven round trips: this runs on mount of the card
  // screen and the whole point of the module's lens design is that a spending
  // decision is one read.
  const [
    registered,
    moduleEnabled,
    maxDailyLimitUsd,
    maxMonthlyLimitUsd,
    defaultDailyLimitUsd,
    defaultMonthlyLimitUsd,
    maxPerTxUsd,
    modulePaused,
    safePaused,
    limit,
    limitRaiseDelay,
  ] = await client.multicall({
    allowFailure: false,
    contracts: [
      { ...module, functionName: 'isRegistered', args: [safeAddress] },
      // The module's own guarded reader, not `Safe.isModuleEnabled` directly: it
      // returns false for an address that cannot answer instead of reverting, which
      // matters because a Solid Safe may still be counterfactual.
      { ...module, functionName: 'isModuleEnabledOn', args: [safeAddress] },
      { ...module, functionName: 'maxDailyLimitUsd' },
      { ...module, functionName: 'maxMonthlyLimitUsd' },
      { ...module, functionName: 'defaultDailyLimitUsd' },
      { ...module, functionName: 'defaultMonthlyLimitUsd' },
      { ...module, functionName: 'maxPerTxUsd' },
      { ...module, functionName: 'isPaused' },
      { ...module, functionName: 'safePaused', args: [safeAddress] },
      // The same reader `spend` settles against, so the caps shown are the caps
      // enforced — including a window that has already rolled over.
      { ...module, functionName: 'applicableSpendingLimit', args: [safeAddress] },
      { ...module, functionName: 'limitRaiseDelay' },
    ],
  });

  return {
    // Deliberately an AND. Registered-but-revoked is a real state (the user turned
    // the module off in a Safe client) and it must read as not set up, because the
    // card genuinely will not work.
    registered: registered && moduleEnabled,
    registeredOnChain: registered,
    moduleEnabled,
    maxDailyLimitUsd,
    maxMonthlyLimitUsd,
    defaultDailyLimitUsd,
    defaultMonthlyLimitUsd,
    maxPerTxUsd,
    modulePaused,
    safePaused,
    limit: {
      dailyLimitUsd: limit.dailyLimit,
      monthlyLimitUsd: limit.monthlyLimit,
      spentTodayUsd: limit.spentToday,
      spentThisMonthUsd: limit.spentThisMonth,
      timezoneOffset: Number(limit.timezoneOffset),
    },
    // The daily and monthly halves of a raise are armed together with one activation
    // time, so the daily one answers for both.
    pendingIncrease:
      limit.dailyLimitActivationTime > 0n
        ? {
            dailyLimitUsd: limit.pendingDailyLimit,
            monthlyLimitUsd: limit.pendingMonthlyLimit,
            activatesAt: limit.dailyLimitActivationTime,
          }
        : null,
    limitRaiseDelaySeconds: Number(limitRaiseDelay),
  };
};

const cardSpendRegistrationQueryOptions = (
  selectedUserId: string | undefined,
  safeAddress: Address | undefined,
) => ({
  queryKey: [CARD_SPEND_REGISTRATION_QUERY_KEY, selectedUserId, safeAddress],
  queryFn: () => readCardSpendRegistration(safeAddress!),
  retry: false,
  staleTime: 15_000,
});

/**
 * The chain state a write is about to be built from, always read fresh.
 *
 * `staleTime: 0` on purpose: the cached copy is good enough to render with, but every
 * mutation here branches on it — whether to include `enableModule`, whether a chosen
 * limit is a decrease or an increase — and each of those branches reverts if the chain
 * has moved. One extra multicall is cheaper than a failed user operation.
 */
const readFresh = (
  queryClient: QueryClient,
  selectedUserId: string | undefined,
  safeAddress: Address,
) =>
  queryClient.fetchQuery({
    ...cardSpendRegistrationQueryOptions(selectedUserId, safeAddress),
    staleTime: 0,
  });

interface UseCardSpendRegistrationOptions {
  /**
   * Read the chain even before the issuer is known.
   *
   * By default this only runs for a Wirex cardholder, which is right everywhere a card
   * already exists. The activation screen is the exception: it registers the module in
   * the same press that creates the card, so the read has to have happened *before*
   * there is a card to resolve an issuer from.
   */
  enabled?: boolean;
}

/**
 * A Wirex cardholder's `SolidCashModule` registration, and the actions that shape it.
 *
 * ## What registration is, and why it replaced the allowance
 *
 * This is the only Wirex card-spend flow. It replaced an ERC-20 allowance on soUSD
 * granted to our card-spend wallet, whose single bound was the approved amount: one
 * number, spendable in one transaction, with no per-transaction ceiling, no rolling
 * window, and no way for the user to see or shape what the card may take over time.
 *
 * `SolidCashModule` moves those bounds on-chain. Registering sets a daily and a monthly
 * cap for this Safe specifically, on top of the module's own per-transaction cap and the
 * live org ceilings. The backend's spender key can only ever send to an immutable
 * treasury address, only in allowlisted tokens (USDC, USDT and soUSD, drawn in that
 * order), only inside those caps, and only once per settlement id. None of that is
 * enforced by our backend — it is enforced by the contract, which is the point.
 *
 * ## Why the chain is read directly rather than trusted from the backend
 *
 * Registration status *is* on-chain state, and two independent facts have to hold: the
 * module must be enabled on the Safe, and the Safe must have registered. A user can
 * revoke the first at any time from any Safe client, with no call to us — the module
 * re-checks it on every debit, so revocation is instant. A cached backend flag would
 * report a card as working after that. So the query is a multicall against Fuse, and the
 * backend is told the outcome afterwards ({@link confirmWirexCardRegistration}) so the
 * sweep engine and support share one record without each re-deriving it.
 *
 * ## Why both calls go in one user operation
 *
 * `registerSafe` requires `msg.sender` to be the Safe, and `Safe.enableModule` requires
 * `msg.sender` to be the Safe itself. Batched into a single user operation both run with
 * the Safe as sender, and the user signs once. Batching also makes it atomic: a Safe
 * cannot end up with the module enabled but unregistered, which would look like a
 * working card that declines everything.
 *
 * ## Changing the limits afterwards
 *
 * The caps are not a one-time answer. {@link updateLimit} lowers or raises them, and the
 * contract treats those two directions differently on purpose: a decrease shrinks the
 * module's authority so it lands immediately, while a raise widens what a compromised
 * backend key could take and therefore only *arms* — it matures after `limitRaiseDelay`,
 * and {@link cancelPendingIncrease} exists so the delay window is something the user can
 * actually act inside.
 */
export function useCardSpendRegistration({ enabled }: UseCardSpendRegistrationOptions = {}) {
  const { provider } = useCardProvider();
  const { user, safeAA } = useUser();
  const queryClient = useQueryClient();
  const selectedUserId = useUserStore(state => state.users.find(u => u.selected)?.userId);
  const [error, setError] = useState<string | null>(null);

  const safeAddress = user?.safeAddress as Address | undefined;
  // Wirex only: a Rain cardholder prefunds their card and has nothing to register.
  // `enabled` overrides the issuer check for the activation screen, where the card that
  // would answer the question does not exist yet.
  const isEnabled = (provider === CardProvider.WIREX || enabled === true) && Boolean(safeAddress);

  const query = useQuery<CardSpendRegistration>({
    ...cardSpendRegistrationQueryOptions(selectedUserId, safeAddress),
    enabled: isEnabled,
  });

  const registration = query.data ?? null;

  /** Everything a completed write invalidates, in one place so no path forgets one. */
  const invalidateAfterWrite = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: [CARD_SPEND_REGISTRATION_QUERY_KEY] });
    // The card's spendable balance is bounded by these caps, so anything showing it is
    // stale the moment they move.
    queryClient.invalidateQueries({ queryKey: ['cardDetails'] });
  }, [queryClient]);

  /**
   * Tell the backend what the chain now says, so support and the sweep engine share one
   * record. Best-effort by design: the state is already on-chain and the query re-reads
   * the chain, so a backend that is down must not make a completed change look failed.
   */
  const confirmWithBackend = useCallback(
    async (body: {
      transactionHash: string;
      dailyLimitUsd: bigint;
      monthlyLimitUsd: bigint;
      timezoneOffset: number;
    }) => {
      try {
        await confirmWirexCardRegistration({
          transactionHash: body.transactionHash,
          dailyLimitUsd: (Number(body.dailyLimitUsd) / 10 ** CASH_USD_DECIMALS).toString(),
          monthlyLimitUsd: (Number(body.monthlyLimitUsd) / 10 ** CASH_USD_DECIMALS).toString(),
          timezoneOffset: body.timezoneOffset,
        });
      } catch {
        // Swallowed on purpose — see above.
      }
    },
    [],
  );

  const mutation = useMutation({
    mutationFn: async ({ dailyLimitUsd }: { dailyLimitUsd: number }) => {
      if (!user?.suborgId || !user?.signWith || !safeAddress) {
        throw new Error('Your wallet is still setting up. Please try again shortly.');
      }

      const fresh = await readFresh(queryClient, selectedUserId, safeAddress);
      if (fresh.registered) throw new Error('Card spending is already set up.');

      const daily = usdToOnChain(dailyLimitUsd);
      const monthly = daily * MONTHLY_LIMIT_MULTIPLIER;

      // Checked here as well as on-chain so a bad choice costs a toast rather than a
      // failed user operation. The contract reverts with ExceedsOrgDailyCeiling /
      // ExceedsOrgMonthlyCeiling, which the user cannot act on. Skipped when
      // re-enabling, where the limits are already set and are not being sent.
      if (!fresh.registeredOnChain && daily > fresh.maxDailyLimitUsd) {
        throw new Error('That daily limit is above the current maximum. Pick a lower one.');
      }
      if (!fresh.registeredOnChain && monthly > fresh.maxMonthlyLimitUsd) {
        throw new Error('That monthly limit is above the current maximum. Pick a lower one.');
      }

      const timezoneOffset = getDeviceTimezoneOffsetSeconds();
      const smartAccountClient = await safeAA(fuse, user.suborgId, user.signWith);

      // Only the calls that are actually needed — each of these reverts if its work is
      // already done, and both half-states are reachable in practice:
      //
      //  - module enabled but never registered: possible if the user enabled it in a
      //    Safe client, or if an earlier attempt was interrupted between the two.
      //    Including `enableModule` again reverts GS102.
      //  - registered but module since disabled: consent withdrawal. Registration is
      //    permanent, so including `registerSafe` again reverts `AlreadyRegistered`,
      //    and re-enabling the module is the whole fix.
      //
      // Building the batch from what is actually missing makes this one action cover
      // first-time setup and re-enabling, instead of stranding the user in either state.
      const transactions = [
        ...(fresh.moduleEnabled
          ? []
          : [
              {
                to: safeAddress,
                data: encodeFunctionData({
                  abi: Safe_ABI,
                  functionName: 'enableModule',
                  args: [MODULE as Address],
                }),
              },
            ]),
        ...(fresh.registeredOnChain
          ? []
          : [
              {
                to: MODULE as Address,
                data: encodeFunctionData({
                  abi: SolidCashModule_ABI,
                  functionName: 'registerSafe',
                  args: [daily, monthly, BigInt(timezoneOffset)],
                }),
              },
            ]),
      ];

      if (transactions.length === 0) throw new Error('Card spending is already set up.');

      const result = await executeTransactions(
        smartAccountClient,
        transactions,
        'Failed to set up card spending',
        fuse,
      );

      if (result === USER_CANCELLED_TRANSACTION) {
        track(TRACKING_EVENTS.CARD_SPEND_REGISTER_CANCELLED, { daily_limit_usd: dailyLimitUsd });
        return null;
      }

      // Re-enabling keeps the limits already stored on-chain, so report those rather
      // than the ones this call did not send.
      await confirmWithBackend({
        transactionHash: result.transactionHash,
        dailyLimitUsd: fresh.registeredOnChain ? fresh.limit.dailyLimitUsd : daily,
        monthlyLimitUsd: fresh.registeredOnChain ? fresh.limit.monthlyLimitUsd : monthly,
        timezoneOffset: fresh.registeredOnChain ? fresh.limit.timezoneOffset : timezoneOffset,
      });

      return { transactionHash: result.transactionHash, dailyLimitUsd, timezoneOffset };
    },
    onSuccess: result => {
      if (!result) return;
      invalidateAfterWrite();
      track(TRACKING_EVENTS.CARD_SPEND_REGISTER_COMPLETED, {
        daily_limit_usd: result.dailyLimitUsd,
        timezone_offset: result.timezoneOffset,
        transaction_hash: result.transactionHash,
      });
    },
    onError: (mutationError: Error) => {
      const message = mutationError?.message || 'Failed to set up card spending';
      setError(message);
      track(TRACKING_EVENTS.CARD_SPEND_REGISTER_FAILED, { error: message });
    },
  });

  /**
   * Move the caps on a Safe that is already registered.
   *
   * One entry point for both directions because the user is answering one question —
   * "what should my daily limit be" — and which contract call that becomes is a detail
   * of how the module protects them, not a choice to put in front of them. The monthly
   * cap follows the daily one, as it does at registration.
   */
  const updateMutation = useMutation({
    mutationFn: async ({ dailyLimitUsd }: { dailyLimitUsd: number }) => {
      if (!user?.suborgId || !user?.signWith || !safeAddress) {
        throw new Error('Your wallet is still setting up. Please try again shortly.');
      }

      const fresh = await readFresh(queryClient, selectedUserId, safeAddress);
      if (!fresh.registeredOnChain) throw new Error('Set up card spending first.');

      const current = fresh.limit;
      const nextDaily = usdToOnChain(dailyLimitUsd);
      if (nextDaily === current.dailyLimitUsd) {
        throw new Error('That is already your daily limit.');
      }

      const isIncrease = nextDaily > current.dailyLimitUsd;
      const nextMonthly = monthlyLimitFor(nextDaily, current);

      if (isIncrease) {
        // Caught here so a raise the org would refuse costs a message rather than a
        // failed user operation. Reachable without the user picking anything silly: the
        // org can lower a ceiling below a limit that was already granted.
        if (nextDaily > fresh.maxDailyLimitUsd) {
          throw new Error('That daily limit is above the current maximum. Pick a lower one.');
        }
        if (nextMonthly > fresh.maxMonthlyLimitUsd) {
          throw new Error('That limit is above the current monthly maximum. Pick a lower one.');
        }
      }

      const smartAccountClient = await safeAA(fuse, user.suborgId, user.signWith);
      const result = await executeTransactions(
        smartAccountClient,
        [
          {
            to: MODULE as Address,
            data: encodeFunctionData({
              abi: SolidCashModule_ABI,
              functionName: isIncrease ? 'requestSpendingLimitIncrease' : 'decreaseSpendingLimit',
              args: [nextDaily, nextMonthly],
            }),
          },
        ],
        isIncrease ? 'Failed to request a higher limit' : 'Failed to lower your limit',
        fuse,
      );

      if (result === USER_CANCELLED_TRANSACTION) {
        track(TRACKING_EVENTS.CARD_SPEND_LIMIT_UPDATE_CANCELLED, {
          daily_limit_usd: dailyLimitUsd,
          is_increase: isIncrease,
        });
        return null;
      }

      await confirmWithBackend({
        transactionHash: result.transactionHash,
        // What the chain enforces *now*, which for a raise is still the old caps — the
        // backend cross-checks this against the chain and logs a mismatch, and a record
        // saying the card may spend more than the module allows is the wrong record.
        dailyLimitUsd: isIncrease ? current.dailyLimitUsd : nextDaily,
        monthlyLimitUsd: isIncrease ? current.monthlyLimitUsd : nextMonthly,
        timezoneOffset: current.timezoneOffset,
      });

      return {
        transactionHash: result.transactionHash,
        dailyLimitUsd,
        isIncrease,
        /** Unix seconds a raise takes effect; undefined for a decrease, which is now. */
        activatesAt: isIncrease
          ? Math.floor(Date.now() / 1000) + fresh.limitRaiseDelaySeconds
          : undefined,
      };
    },
    onSuccess: result => {
      if (!result) return;
      invalidateAfterWrite();
      track(TRACKING_EVENTS.CARD_SPEND_LIMIT_UPDATE_COMPLETED, {
        daily_limit_usd: result.dailyLimitUsd,
        is_increase: result.isIncrease,
        transaction_hash: result.transactionHash,
      });
    },
    onError: (mutationError: Error) => {
      const message = mutationError?.message || 'Failed to change your limit';
      setError(message);
      track(TRACKING_EVENTS.CARD_SPEND_LIMIT_UPDATE_FAILED, { error: message });
    },
  });

  /** Disarm a requested raise before it matures. */
  const cancelIncreaseMutation = useMutation({
    mutationFn: async () => {
      if (!user?.suborgId || !user?.signWith || !safeAddress) {
        throw new Error('Your wallet is still setting up. Please try again shortly.');
      }

      const fresh = await readFresh(queryClient, selectedUserId, safeAddress);
      // Either it matured while the sheet sat open, or another client cancelled it.
      // Sending the call anyway would succeed and change nothing, which is a signature
      // spent to tell the user something the re-read already told them.
      if (!fresh.pendingIncrease) throw new Error('There is no pending limit change.');

      const smartAccountClient = await safeAA(fuse, user.suborgId, user.signWith);
      const result = await executeTransactions(
        smartAccountClient,
        [
          {
            to: MODULE as Address,
            data: encodeFunctionData({
              abi: SolidCashModule_ABI,
              functionName: 'cancelPendingSpendingLimitIncrease',
            }),
          },
        ],
        'Failed to cancel the limit change',
        fuse,
      );

      if (result === USER_CANCELLED_TRANSACTION) return null;

      return { transactionHash: result.transactionHash };
    },
    onSuccess: result => {
      if (!result) return;
      invalidateAfterWrite();
      track(TRACKING_EVENTS.CARD_SPEND_PENDING_INCREASE_CANCEL_COMPLETED, {
        transaction_hash: result.transactionHash,
      });
    },
    onError: (mutationError: Error) => {
      const message = mutationError?.message || 'Failed to cancel the limit change';
      setError(message);
      track(TRACKING_EVENTS.CARD_SPEND_PENDING_INCREASE_CANCEL_FAILED, { error: message });
    },
  });

  /**
   * Withdraw module consent: `Safe.disableModule`, leaving the Safe registered but unable
   * to be debited.
   *
   * This is as far back as the chain lets us go, and it is the whole of what matters.
   * `registerSafe` has no counterpart — registration and the limits it wrote are
   * permanent — but the module re-checks `isModuleEnabled` on every debit, so a disabled
   * module declines immediately. The user lands in the `isRevoked` state, from which the
   * existing setup action re-enables with the same limits rather than asking for them
   * again.
   */
  const disableMutation = useMutation({
    mutationFn: async () => {
      if (!user?.suborgId || !user?.signWith || !safeAddress) {
        throw new Error('Your wallet is still setting up. Please try again shortly.');
      }

      const fresh = await readFresh(queryClient, selectedUserId, safeAddress);
      if (!fresh.moduleEnabled) throw new Error('Card spending is already off.');

      // `disableModule` takes the list entry that points at the module, so the list has to
      // be read first — it cannot be derived, and passing the wrong predecessor reverts
      // GS103. Read at press time rather than cached with the rest of the registration:
      // enabling any other module rewrites these pointers, and a stale predecessor is a
      // failed user operation.
      const client = publicClient(fuse.id);
      const [modules] = await client.readContract({
        address: safeAddress,
        abi: Safe_ABI,
        functionName: 'getModulesPaginated',
        args: [SENTINEL_MODULES, MODULE_PAGE_SIZE],
      });

      const index = modules.findIndex(
        module => module.toLowerCase() === (MODULE as string).toLowerCase(),
      );
      // Not on the list at all: the chain disagrees with what we read a moment ago (another
      // client disabled it). Nothing to do, and sending the transaction would only revert.
      if (index === -1) throw new Error('Card spending is already off.');

      // `getModulesPaginated` walks from the sentinel outwards, so the entry before the
      // module in this array is exactly the one pointing at it — and for the first entry
      // that is the sentinel.
      const prevModule = index === 0 ? SENTINEL_MODULES : modules[index - 1];

      const smartAccountClient = await safeAA(fuse, user.suborgId, user.signWith);
      const result = await executeTransactions(
        smartAccountClient,
        [
          {
            to: safeAddress,
            data: encodeFunctionData({
              abi: Safe_ABI,
              functionName: 'disableModule',
              args: [prevModule, MODULE as Address],
            }),
          },
        ],
        'Failed to turn off card spending',
        fuse,
      );

      if (result === USER_CANCELLED_TRANSACTION) {
        track(TRACKING_EVENTS.CARD_SPEND_DISABLE_CANCELLED);
        return null;
      }

      return { transactionHash: result.transactionHash };
    },
    onSuccess: result => {
      if (!result) return;
      invalidateAfterWrite();
      track(TRACKING_EVENTS.CARD_SPEND_DISABLE_COMPLETED, {
        transaction_hash: result.transactionHash,
      });
    },
    onError: (mutationError: Error) => {
      const message = mutationError?.message || 'Failed to turn off card spending';
      setError(message);
      track(TRACKING_EVENTS.CARD_SPEND_DISABLE_FAILED, { error: message });
    },
  });

  /**
   * Enable the module and register, with the chosen daily limit.
   *
   * Resolves `true` once registered, `false` when the user dismissed the signature
   * prompt, and rejects on a real failure. The false case has to be distinguishable: a
   * cancelled signature is not an error to show, but telling the user their card is set
   * up when it is not would be worse.
   */
  const register = useCallback(
    async (
      dailyLimitUsd: number,
      source: CardSpendRegistrationSource = 'spending_sheet',
    ): Promise<boolean> => {
      setError(null);
      track(TRACKING_EVENTS.CARD_SPEND_REGISTER_PRESSED, {
        daily_limit_usd: dailyLimitUsd,
        source,
      });
      const result = await mutation.mutateAsync({ dailyLimitUsd });
      return result !== null;
    },
    [mutation],
  );

  /**
   * Change the daily limit on an existing registration.
   *
   * Resolves with what happened, so the caller can say the one thing the user needs to
   * hear next — a decrease is already in force, a raise is only booked — or `null` when
   * the signature prompt was dismissed and nothing changed at all.
   */
  const updateLimit = useCallback(
    async (
      dailyLimitUsd: number,
    ): Promise<{ isIncrease: boolean; activatesAt?: number } | null> => {
      setError(null);
      track(TRACKING_EVENTS.CARD_SPEND_LIMIT_UPDATE_PRESSED, { daily_limit_usd: dailyLimitUsd });
      const result = await updateMutation.mutateAsync({ dailyLimitUsd });
      return result && { isIncrease: result.isIncrease, activatesAt: result.activatesAt };
    },
    [updateMutation],
  );

  /** Drop a requested raise. `false` when the signature prompt was dismissed. */
  const cancelPendingIncrease = useCallback(async (): Promise<boolean> => {
    setError(null);
    track(TRACKING_EVENTS.CARD_SPEND_PENDING_INCREASE_CANCEL_PRESSED);
    const result = await cancelIncreaseMutation.mutateAsync();
    return result !== null;
  }, [cancelIncreaseMutation]);

  /**
   * Turn card spending off again. Resolves `true` once the module is disabled, `false`
   * when the user dismissed the signature prompt, and rejects on a real failure — the
   * same three outcomes as {@link register}, for the same reason: telling someone their
   * card is off while it still spends would be the worst of the three to get wrong.
   */
  const disable = useCallback(async (): Promise<boolean> => {
    setError(null);
    track(TRACKING_EVENTS.CARD_SPEND_DISABLE_PRESSED);
    const result = await disableMutation.mutateAsync();
    return result !== null;
  }, [disableMutation]);

  return {
    registration,
    /** Whether to offer the control at all. */
    isAvailable: isEnabled,
    /** Set up and usable. The control shows as done. */
    isRegistered: registration?.registered === true,
    /**
     * Registered on-chain but the module has been turned off on the Safe. The card will
     * decline, and re-registering is impossible (`AlreadyRegistered`) — only re-enabling
     * the module fixes it, so this state needs its own message rather than a retry.
     */
    isRevoked: registration?.registeredOnChain === true && registration.moduleEnabled === false,
    /** Guardian pause, global or per-Safe. Setup is pointless until it lifts. */
    isPaused: registration?.modulePaused === true || registration?.safePaused === true,
    /**
     * Whether to offer the off switch: the module is live on this Safe, so there is
     * consent to withdraw. False in the revoked state, where it is already off.
     */
    canDisable: registration?.moduleEnabled === true,
    /** The Safe's live caps, or null before the first read lands. */
    limit: registration?.limit ?? null,
    /** A raise that has been asked for and has not taken effect yet. */
    pendingIncrease: registration?.pendingIncrease ?? null,
    isLoading: query.isLoading,
    isRegistering: mutation.isPending,
    isUpdatingLimit: updateMutation.isPending,
    isCancellingIncrease: cancelIncreaseMutation.isPending,
    isDisabling: disableMutation.isPending,
    error,
    register,
    updateLimit,
    cancelPendingIncrease,
    disable,
    refetch: query.refetch,
  };
}
