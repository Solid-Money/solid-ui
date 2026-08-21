import { useCallback, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Address, encodeFunctionData } from 'viem';
import { fuse } from 'viem/chains';

import {
  CASH_USD_DECIMALS,
  getDeviceTimezoneOffsetSeconds,
  MONTHLY_LIMIT_MULTIPLIER,
  usdToOnChain,
} from '@/constants/cardSpendModule';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { useCardProvider } from '@/hooks/useCardProvider';
import useUser from '@/hooks/useUser';
import { Safe_ABI } from '@/lib/abis/Safe';
import { SolidCashModule_ABI } from '@/lib/abis/SolidCashModule';
import { track } from '@/lib/analytics';
import { confirmWirexCardRegistration } from '@/lib/api';
import { ADDRESSES, IS_WIREX_TEST } from '@/lib/config';
import { executeTransactions, USER_CANCELLED_TRANSACTION } from '@/lib/execute';
import { CardProvider } from '@/lib/types';
import { publicClient } from '@/lib/wagmi';
import { useUserStore } from '@/store/useUserStore';

export const CARD_SPEND_REGISTRATION_QUERY_KEY = 'cardSpendRegistration';

const MODULE = ADDRESSES.fuse.cashModule;

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
}

/**
 * A Wirex cardholder's `SolidCashModule` registration, and the action that creates it.
 *
 * ## What registration is, and why it replaces the allowance
 *
 * The shipped flow (`useCardSpendAuthorization`) grants an ERC-20 allowance on soUSD to
 * our card-spend wallet. That works, but the only bound it carries is the allowance
 * amount: one number, spendable in one transaction, with no per-transaction ceiling, no
 * rolling window, and no way for the user to see or shape what the card may take over
 * time.
 *
 * `SolidCashModule` moves those bounds on-chain. Registering sets a daily and a monthly
 * cap for this Safe specifically, on top of the module's own per-transaction cap and the
 * live org ceilings. The backend's spender key can only ever send to an immutable
 * treasury address, only in allowlisted tokens, only inside those caps, and only once
 * per settlement id. None of that is enforced by our backend — it is enforced by the
 * contract, which is the point.
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
 */
export function useCardSpendRegistration() {
  const { provider } = useCardProvider();
  const { user, safeAA } = useUser();
  const queryClient = useQueryClient();
  const selectedUserId = useUserStore(state => state.users.find(u => u.selected)?.userId);
  const [error, setError] = useState<string | null>(null);

  const safeAddress = user?.safeAddress as Address | undefined;
  // Wirex only, and only in test mode: a Rain cardholder prefunds their card and has
  // nothing to register, and the module's owner/guardian keys are not yet split for
  // production use.
  const isEnabled = IS_WIREX_TEST && provider === CardProvider.WIREX && Boolean(safeAddress);

  const query = useQuery<CardSpendRegistration>({
    queryKey: [CARD_SPEND_REGISTRATION_QUERY_KEY, selectedUserId, safeAddress],
    queryFn: async () => {
      const client = publicClient(fuse.id);
      const module = { address: MODULE as Address, abi: SolidCashModule_ABI } as const;

      // One multicall rather than nine round trips: this runs on mount of the card
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
      ] = await client.multicall({
        allowFailure: false,
        contracts: [
          { ...module, functionName: 'isRegistered', args: [safeAddress!] },
          // The module's own guarded reader, not `Safe.isModuleEnabled` directly: it
          // returns false for an address that cannot answer instead of reverting, which
          // matters because a Solid Safe may still be counterfactual.
          { ...module, functionName: 'isModuleEnabledOn', args: [safeAddress!] },
          { ...module, functionName: 'maxDailyLimitUsd' },
          { ...module, functionName: 'maxMonthlyLimitUsd' },
          { ...module, functionName: 'defaultDailyLimitUsd' },
          { ...module, functionName: 'defaultMonthlyLimitUsd' },
          { ...module, functionName: 'maxPerTxUsd' },
          { ...module, functionName: 'isPaused' },
          { ...module, functionName: 'safePaused', args: [safeAddress!] },
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
      };
    },
    enabled: isEnabled,
    retry: false,
    staleTime: 15_000,
  });

  const registration = query.data ?? null;

  const mutation = useMutation({
    mutationFn: async ({ dailyLimitUsd }: { dailyLimitUsd: number }) => {
      if (!registration) throw new Error('Still reading your card settings. Please try again.');
      if (!user?.suborgId || !user?.signWith || !safeAddress) {
        throw new Error('Your wallet is still setting up. Please try again shortly.');
      }
      if (registration.registered) throw new Error('Card spending is already set up.');

      const daily = usdToOnChain(dailyLimitUsd);
      const monthly = daily * MONTHLY_LIMIT_MULTIPLIER;

      // Checked here as well as on-chain so a bad choice costs a toast rather than a
      // failed user operation. The contract reverts with ExceedsOrgDailyCeiling /
      // ExceedsOrgMonthlyCeiling, which the user cannot act on. Skipped when
      // re-enabling, where the limits are already set and are not being sent.
      if (!registration.registeredOnChain && daily > registration.maxDailyLimitUsd) {
        throw new Error('That daily limit is above the current maximum. Pick a lower one.');
      }
      if (!registration.registeredOnChain && monthly > registration.maxMonthlyLimitUsd) {
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
        ...(registration.moduleEnabled
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
        ...(registration.registeredOnChain
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

      // Best-effort. The registration is already on-chain and the query re-reads the
      // chain, so a backend that is down must not make a completed setup look failed —
      // it only means the record is reconciled later.
      try {
        await confirmWirexCardRegistration({
          transactionHash: result.transactionHash,
          dailyLimitUsd: (Number(daily) / 10 ** CASH_USD_DECIMALS).toString(),
          monthlyLimitUsd: (Number(monthly) / 10 ** CASH_USD_DECIMALS).toString(),
          timezoneOffset,
        });
      } catch {
        // Swallowed on purpose — see above.
      }

      return { transactionHash: result.transactionHash, dailyLimitUsd, timezoneOffset };
    },
    onSuccess: result => {
      if (!result) return;
      queryClient.invalidateQueries({ queryKey: [CARD_SPEND_REGISTRATION_QUERY_KEY] });
      // The card's spendable balance is now bounded by these caps, so anything showing
      // it is stale.
      queryClient.invalidateQueries({ queryKey: ['cardDetails'] });
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
   * Enable the module and register, with the chosen daily limit.
   *
   * Resolves `true` once registered, `false` when the user dismissed the signature
   * prompt, and rejects on a real failure. The false case has to be distinguishable: a
   * cancelled signature is not an error to show, but telling the user their card is set
   * up when it is not would be worse.
   */
  const register = useCallback(
    async (dailyLimitUsd: number): Promise<boolean> => {
      setError(null);
      track(TRACKING_EVENTS.CARD_SPEND_REGISTER_PRESSED, { daily_limit_usd: dailyLimitUsd });
      const result = await mutation.mutateAsync({ dailyLimitUsd });
      return result !== null;
    },
    [mutation],
  );

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
    isLoading: query.isLoading,
    isRegistering: mutation.isPending,
    error,
    register,
    refetch: query.refetch,
  };
}
