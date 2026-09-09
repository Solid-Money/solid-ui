import { useCallback, useState } from 'react';
import { QueryClient, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Address, encodeFunctionData } from 'viem';
import { fuse } from 'viem/chains';

import {
  CASH_USD_DECIMALS,
  getDeviceTimezoneOffsetSeconds,
  MONTHLY_LIMIT_MULTIPLIER,
  onChainToUsd,
  spendLimitRejection,
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

/**
 * Where a registration or limit change was started from, for the funnel.
 *
 * `card_reveal` is the gate on the card-details reveal: a card whose Safe cannot be
 * debited declines every payment, so "Show details" opens the spending sheet instead of
 * handing over the PAN. Worth telling apart from `spending_sheet` — someone who came
 * looking for their card number is being asked a question they did not go there to
 * answer, and how many of them finish it is the thing to watch.
 */
export type CardSpendRegistrationSource = 'spending_sheet' | 'card_activation' | 'card_reveal';

/** The Safe's live limit state, with every matured transition already applied. */
export interface CardSpendLimit {
  dailyLimitUsd: bigint;
  monthlyLimitUsd: bigint;
  spentTodayUsd: bigint;
  spentThisMonthUsd: bigint;
  /**
   * Unix seconds the daily window resets on, at which point `spentTodayUsd` goes back to
   * zero. Recomputed by the module on every read, so it is always the *next* reset.
   */
  dailyRenewalTimestamp: bigint;
  /** Unix seconds the monthly window resets on. */
  monthlyRenewalTimestamp: bigint;
  /** The offset the rolling windows reset on. Written at registration, no setter. */
  timezoneOffset: number;
}

/**
 * A move of a Safe's caps, in whole dollars.
 *
 * Both halves are optional, and an omitted one is left exactly as stored: the caps are
 * independent decisions, so editing one never moves the other.
 */
export interface CardSpendLimitChange {
  dailyLimitUsd?: number;
  monthlyLimitUsd?: number;
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
  /**
   * Hard cap on one card transaction, independent of the rolling windows.
   *
   * Configured equal to the org's daily ceiling, so in normal operation it cannot bind
   * before the daily limit does and the sheet does not name it. Still read on every load:
   * lowering it is a live ops throttle, and a cap that does bind has to be visible.
   */
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

  // `applicableSpendingLimit` matures a pending increase only once a block's timestamp has
  // gone *past* the activation time, so a raise signed while `limitRaiseDelay` is zero
  // still reads as pending until the chain ticks past the block it landed in. Read back
  // straight after the write — which is exactly when this runs — that means reporting the
  // cap the user has just replaced, for a whole block time, with no further refetch due.
  //
  // So a raise whose activation instant has already passed in wall-clock terms is folded
  // in here: the only reason the reader still calls it pending is that no block has been
  // mined since, the chain agrees within one, and nothing can be spent in between that the
  // new cap would not have allowed anyway.
  const nowSeconds = BigInt(Math.floor(Date.now() / 1000));
  const activatesAt = limit.dailyLimitActivationTime;
  const isRaiseEffective = activatesAt > 0n && activatesAt <= nowSeconds;

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
      dailyLimitUsd: isRaiseEffective ? limit.pendingDailyLimit : limit.dailyLimit,
      monthlyLimitUsd: isRaiseEffective ? limit.pendingMonthlyLimit : limit.monthlyLimit,
      spentTodayUsd: limit.spentToday,
      spentThisMonthUsd: limit.spentThisMonth,
      dailyRenewalTimestamp: limit.dailyRenewalTimestamp,
      monthlyRenewalTimestamp: limit.monthlyRenewalTimestamp,
      timezoneOffset: Number(limit.timezoneOffset),
    },
    // The daily and monthly halves of a raise are armed together with one activation
    // time, so the daily one answers for both.
    pendingIncrease:
      activatesAt > 0n && !isRaiseEffective
        ? {
            dailyLimitUsd: limit.pendingDailyLimit,
            monthlyLimitUsd: limit.pendingMonthlyLimit,
            activatesAt,
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
    mutationFn: async ({ dailyLimitUsd, monthlyLimitUsd }: CardSpendLimitChange) => {
      if (!user?.suborgId || !user?.signWith || !safeAddress) {
        throw new Error('Your wallet is still setting up. Please try again shortly.');
      }
      if (dailyLimitUsd === undefined) throw new Error('Pick a daily limit first.');

      const fresh = await readFresh(queryClient, selectedUserId, safeAddress);
      if (fresh.registered) throw new Error('Card spending is already set up.');

      const daily = usdToOnChain(dailyLimitUsd);
      // Ten times the daily unless the caller named one, which the limit editor does when
      // the monthly row is the one the user filled in: `registerSafe` writes both caps and
      // whichever they typed is the one to write verbatim.
      const monthly =
        monthlyLimitUsd === undefined
          ? daily * MONTHLY_LIMIT_MULTIPLIER
          : usdToOnChain(monthlyLimitUsd);

      // Checked here as well as on-chain so a bad choice costs a message rather than a
      // failed user operation: the contract reverts with ExceedsOrgDailyCeiling /
      // ExceedsOrgMonthlyCeiling, which the user cannot act on. Same helper the limit
      // field validates with — an unregistered Safe's stored caps are zeros, so every
      // value is a raise and both ceilings bind. Skipped when re-enabling, where the caps
      // are already stored and are not being sent.
      if (!fresh.registeredOnChain) {
        const rejection = spendLimitRejection(
          { dailyLimitUsd: 0n, monthlyLimitUsd: 0n },
          { dailyLimitUsd: daily, monthlyLimitUsd: monthly },
          fresh,
        );
        if (rejection) throw new Error(rejection);
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
   * One entry point for both caps and both directions, because which contract call a
   * change becomes — `decreaseSpendingLimit` or `requestSpendingLimitIncrease` — is a
   * detail of how the module protects the user rather than a choice to put in front of
   * them.
   *
   * A cap the caller does not name stays exactly as stored. That keeps both on the same
   * side of the stored pair, which the contract requires (`decrease` reverts if either
   * went up, `requestIncrease` if either went down): the untouched one is equal, and
   * equal satisfies both.
   */
  const updateMutation = useMutation({
    mutationFn: async ({ dailyLimitUsd, monthlyLimitUsd }: CardSpendLimitChange) => {
      if (!user?.suborgId || !user?.signWith || !safeAddress) {
        throw new Error('Your wallet is still setting up. Please try again shortly.');
      }

      const fresh = await readFresh(queryClient, selectedUserId, safeAddress);
      if (!fresh.registeredOnChain) throw new Error('Set up card spending first.');

      // A cap the caller did not name is left exactly where it was. The two are stored
      // independently and each is a separate decision, so an edit of one must not move the
      // other — the contract only insists they stay ordered, which the rejection below
      // checks and reports rather than silently fixing.
      const current = fresh.limit;
      const nextDaily =
        dailyLimitUsd === undefined ? current.dailyLimitUsd : usdToOnChain(dailyLimitUsd);
      const nextMonthly =
        monthlyLimitUsd === undefined ? current.monthlyLimitUsd : usdToOnChain(monthlyLimitUsd);

      if (nextDaily === current.dailyLimitUsd && nextMonthly === current.monthlyLimitUsd) {
        throw new Error('Those are already your limits.');
      }

      // Checked against the caps read a moment ago rather than the ones the sheet
      // rendered with, so a ceiling the org moved in between costs a message instead of a
      // failed user operation. Same helper the field validates with, so the user never
      // meets a second, differently worded refusal after pressing Confirm.
      const rejection = spendLimitRejection(
        current,
        { dailyLimitUsd: nextDaily, monthlyLimitUsd: nextMonthly },
        fresh,
        monthlyLimitUsd === undefined ? 'daily' : 'monthly',
      );
      if (rejection) throw new Error(rejection);

      const isIncrease = nextDaily > current.dailyLimitUsd || nextMonthly > current.monthlyLimitUsd;

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
          daily_limit_usd: onChainToUsd(nextDaily),
          monthly_limit_usd: onChainToUsd(nextMonthly),
          is_increase: isIncrease,
        });
        return null;
      }

      // What the module will be enforcing by the time the backend cross-checks this
      // against the chain — a record saying the card may spend more than the module
      // allows is the wrong record. A decrease is in force immediately; a raise is in
      // force on the first block past `limitRaiseDelay`, which at the delay's configured
      // zero is the next one, so only a delay someone has actually turned on leaves the
      // old caps true for long enough to be worth reporting.
      const isRaiseStillWaiting = isIncrease && fresh.limitRaiseDelaySeconds > 0;
      await confirmWithBackend({
        transactionHash: result.transactionHash,
        dailyLimitUsd: isRaiseStillWaiting ? current.dailyLimitUsd : nextDaily,
        monthlyLimitUsd: isRaiseStillWaiting ? current.monthlyLimitUsd : nextMonthly,
        timezoneOffset: current.timezoneOffset,
      });

      return {
        transactionHash: result.transactionHash,
        dailyLimitUsd: onChainToUsd(nextDaily),
        monthlyLimitUsd: onChainToUsd(nextMonthly),
        isIncrease,
      };
    },
    onSuccess: result => {
      if (!result) return;
      invalidateAfterWrite();
      track(TRACKING_EVENTS.CARD_SPEND_LIMIT_UPDATE_COMPLETED, {
        daily_limit_usd: result.dailyLimitUsd,
        monthly_limit_usd: result.monthlyLimitUsd,
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
      /** Ten times the daily cap when omitted, as the activation press wants. */
      monthlyLimitUsd?: number,
    ): Promise<boolean> => {
      setError(null);
      track(TRACKING_EVENTS.CARD_SPEND_REGISTER_PRESSED, {
        daily_limit_usd: dailyLimitUsd,
        monthly_limit_usd: monthlyLimitUsd,
        source,
      });
      const result = await mutation.mutateAsync({ dailyLimitUsd, monthlyLimitUsd });
      return result !== null;
    },
    [mutation],
  );

  /**
   * Change the caps on an existing registration.
   *
   * Resolves with the pair now in force, so the caller can name the number the user just
   * set rather than the one it derived, or `null` when the signature prompt was dismissed
   * and nothing changed at all.
   */
  const updateLimit = useCallback(
    async (
      change: CardSpendLimitChange,
    ): Promise<{ dailyLimitUsd: number; monthlyLimitUsd: number } | null> => {
      setError(null);
      track(TRACKING_EVENTS.CARD_SPEND_LIMIT_UPDATE_PRESSED, {
        daily_limit_usd: change.dailyLimitUsd,
        monthly_limit_usd: change.monthlyLimitUsd,
      });
      const result = await updateMutation.mutateAsync(change);
      return (
        result && {
          dailyLimitUsd: result.dailyLimitUsd,
          monthlyLimitUsd: result.monthlyLimitUsd,
        }
      );
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
