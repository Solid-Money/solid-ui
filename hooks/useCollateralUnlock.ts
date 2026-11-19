import { useCallback, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { type Address, type Chain, encodeFunctionData, erc20Abi, maxUint256 } from 'viem';
import { base, fuse } from 'viem/chains';

import { formatUsd } from '@/constants/cardSpendModule';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import {
  type CreditInstancePosition,
  creditInstanceQuery,
  type PendingCollateralUnlock,
  readCreditInstance,
  useCreditInstanceAddresses,
} from '@/hooks/useCardCreditPositions';
import {
  CARD_REPAY_QUERY_KEY,
  type CardRepayChainId,
  cardRepayQueryOptions,
} from '@/hooks/useCardRepay';
import { CARD_SPEND_REGISTRATION_QUERY_KEY } from '@/hooks/useCardSpendRegistration';
import useUser from '@/hooks/useUser';
import { SolidCashModuleV2_ABI } from '@/lib/abis/SolidCashModuleV2';
import { track } from '@/lib/analytics';
import { buildLoan, quoteUnlock, unitsCeil, type UnlockRepaySource, WAD } from '@/lib/creditRisk';
import { getUserErrorMessage, sanitizeTechnicalMessage } from '@/lib/errors';
import { executeTransactions, USER_CANCELLED_TRANSACTION } from '@/lib/execute';
import { useUserStore } from '@/store/useUserStore';

/** How the repayment an unlock needs is paid. */
export type UnlockRepayPlan =
  | { kind: 'none' }
  /** A tender token in the wallet: the repay state's `wallet:` source id. */
  | { kind: 'wallet'; sourceId: string }
  /** Another asset locked in the same loan. */
  | { kind: 'collateral'; token: Address };

export interface UnlockRequest {
  /** The asset to unlock. */
  token: Address;
  /** Token units. */
  amount: bigint;
  repay: UnlockRepayPlan;
  /**
   * The repayment the cardholder agreed to. A fresh quote above it stops the signature: prices
   * moved, and what is signed must never be more than what was shown.
   */
  confirmedRepayUsd: bigint;
}

export interface UnlockResult {
  transactionHash: string;
  repayUsd: bigint;
}

/**
 * Why finishing an unlock cannot go ahead. `needs-more-cover` is the module's own release check
 * (`ExceedsBorrowingPower`): the loan moved during the wait and no longer covers the unlock.
 */
export class UnlockBlockedError extends Error {
  constructor(
    readonly reason: 'needs-more-cover' | 'not-ready' | 'nothing-pending',
    message: string,
  ) {
    super(message);
    this.name = 'UnlockBlockedError';
  }
}

/** A refusal written for the cardholder: shown as it is, never classified as a failure. */
export class UnlockUserError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnlockUserError';
  }
}

/** What to show for a failed step: our own words as they are, anything else translated. */
const describeFailure = (failure: Error): string | null =>
  failure instanceof UnlockUserError || failure instanceof UnlockBlockedError
    ? failure.message
    : getUserErrorMessage(failure, { action: 'card_unlock' }) || null;

const sameToken = (a: Address, b: Address) => a.toLowerCase() === b.toLowerCase();

/** Refuses when the unlock waiting on the loan is not the one the cardholder is looking at. */
const requireSamePending = (
  pending: PendingCollateralUnlock,
  expected: PendingCollateralUnlock | undefined,
) => {
  if (
    expected &&
    (!sameToken(pending.token, expected.token) ||
      pending.amount !== expected.amount ||
      pending.readyAt !== expected.readyAt)
  ) {
    throw new UnlockUserError(
      'The unlock waiting on this loan has changed. Check it and try again.',
    );
  }
};

/**
 * Unlocking part of a locked asset while the loan stays open, on one instance.
 *
 * `request` is one signature: the repayment the unlock needs, if any — from a wallet tender
 * token (`repayFromSafe`) or from another asset locked in the same loan (`repayFromCollateral`) —
 * then `requestCollateralWithdrawal`. The asset moves after `collateralWithdrawDelay`, when
 * `finish` calls `processCollateralWithdrawal`, which re-checks the loan; `cancel` disarms it.
 * The module allows one pending unlock per Safe on an instance.
 *
 * Like the repay flow, everything is re-read and re-quoted right before signing, so a price or
 * debt that moved while the sheet sat open costs a message rather than a failed operation.
 *
 * Finishing is the cardholder's own signature. `processCollateralWithdrawal` is permissionless
 * and could be sent by the backend, but nothing does that today — the backend never moves a
 * cardholder's assets — so the app asks for it once the wait is over.
 */
export function useCollateralUnlock(chainId: CardRepayChainId) {
  const { user, safeAA } = useUser();
  const queryClient = useQueryClient();
  const selectedUserId = useUserStore(state => state.users.find(u => u.selected)?.userId);
  const instance = useCreditInstanceAddresses()[chainId];
  const [error, setError] = useState<string | null>(null);

  const chain: Chain = chainId === base.id ? base : fuse;
  const safe = user?.safeAddress as Address | undefined;
  const moduleAddress = instance?.moduleAddress;

  const freshPosition = useCallback(async (): Promise<CreditInstancePosition> => {
    if (!safe || !moduleAddress || !instance?.lensAddress) {
      throw new UnlockUserError('Your wallet is still setting up. Please try again shortly.');
    }
    // Read directly rather than through the cache: `fetchQuery` would hand back a poll that was
    // already in flight before the press. That poll is cancelled first, so it cannot land after
    // this read and put an older block's position back on screen.
    const { queryKey } = creditInstanceQuery(
      chainId,
      moduleAddress,
      instance.lensAddress,
      safe,
      true,
    );
    await queryClient.cancelQueries({ queryKey, exact: true });
    const position = await readCreditInstance(chainId, moduleAddress, instance.lensAddress, safe);
    queryClient.setQueryData(queryKey, position);
    if (!position) throw new UnlockUserError('Could not read your loan. Please try again.');
    return position;
  }, [chainId, instance?.lensAddress, moduleAddress, queryClient, safe]);

  const send = useCallback(
    async (calls: { to: Address; data: `0x${string}` }[], failure: string) => {
      if (!user?.suborgId || !user?.signWith) {
        throw new UnlockUserError('Your wallet is still setting up. Please try again shortly.');
      }
      const client = await safeAA(chain, user.suborgId, user.signWith);
      return executeTransactions(client, calls, failure, chain);
    },
    [chain, safeAA, user?.signWith, user?.suborgId],
  );

  const refresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: [CARD_SPEND_REGISTRATION_QUERY_KEY] });
    queryClient.invalidateQueries({ queryKey: [CARD_REPAY_QUERY_KEY] });
    queryClient.invalidateQueries({ queryKey: ['tokenBalances'] });
  }, [queryClient]);

  const requestMutation = useMutation({
    mutationFn: async (request: UnlockRequest): Promise<UnlockResult | null> => {
      const position = await freshPosition();
      if (position.pendingUnlock) {
        throw new UnlockUserError(
          'Finish or cancel the unlock that’s already waiting on this loan first.',
        );
      }
      const now = Math.floor(Date.now() / 1000);
      const loan = buildLoan(position, now);
      const asset = loan.assets.find(candidate => sameToken(candidate.token, request.token));
      if (!asset) throw new UnlockUserError('That asset is no longer locked in this loan.');

      let source: UnlockRepaySource = { kind: 'wallet' };
      if (request.repay.kind === 'collateral') {
        const repayToken = request.repay.token;
        const locked = loan.assets.find(candidate => sameToken(candidate.token, repayToken));
        if (!locked) throw new UnlockUserError('That asset is no longer locked in this loan.');
        source = { kind: 'collateral', asset: locked };
        // Repaying from it divides by its price, which the module refuses outside its band.
        if (!locked.priceInBand) {
          throw new UnlockUserError(
            'That asset’s price is unavailable right now, so it can’t repay this loan.',
          );
        }
      }

      const quote = quoteUnlock({
        position,
        loan,
        asset,
        amount: request.amount,
        source,
        nowSeconds: now,
      });
      if (quote.requiresFullRepay) {
        throw new UnlockUserError('Getting this back now means repaying the whole loan.');
      }
      if (quote.unavailableReason) throw new UnlockUserError(quote.unavailableReason);
      if (quote.amount === 0n || quote.amount !== request.amount) {
        throw new UnlockUserError(
          'Less of this is locked now than when you chose the amount. Check it and try again.',
        );
      }
      if (quote.repayUsd > request.confirmedRepayUsd) {
        throw new UnlockUserError(
          `Prices moved: this now needs ${formatUsd(quote.repayUsd)} repaid first. Check it and try again.`,
        );
      }

      const calls: { to: Address; data: `0x${string}` }[] = [];
      if (quote.repayUsd > 0n) {
        if (request.repay.kind === 'none')
          throw new UnlockUserError('This unlock needs a repayment first.');

        if (request.repay.kind === 'collateral') {
          calls.push({
            to: position.moduleAddress,
            data: encodeFunctionData({
              abi: SolidCashModuleV2_ABI,
              functionName: 'repayFromCollateral',
              args: [safe!, request.repay.token, quote.repayUsd],
            }),
          });
        } else {
          const repay = await queryClient.fetchQuery({
            ...cardRepayQueryOptions(chainId, position.moduleAddress, selectedUserId, safe),
            staleTime: 0,
          });
          const sourceId = request.repay.sourceId;
          const tender = repay.sources.find(
            candidate => candidate.id === sourceId && candidate.kind === 'wallet',
          );
          if (!tender || tender.unavailableReason) {
            throw new UnlockUserError(
              tender?.unavailableReason ?? 'That payment option is no longer available.',
            );
          }
          // Rounded up, so the module's rounded-down valuation still retires the whole figure.
          const amount = unitsCeil(quote.repayUsd, tender.priceUsd, tender.decimals);
          if (amount > tender.balance) {
            throw new UnlockUserError(`Not enough ${tender.displaySymbol} in your wallet.`);
          }
          if (repay.moduleEnabled) {
            calls.push({
              to: position.moduleAddress,
              data: encodeFunctionData({
                abi: SolidCashModuleV2_ABI,
                functionName: 'repayFromSafe',
                args: [safe!, tender.token, amount],
              }),
            });
          } else {
            // A cardholder who revoked the module still owes: the permissionless `repay`, behind
            // an exact allowance cleared again afterwards.
            calls.push(
              {
                to: tender.token,
                data: encodeFunctionData({
                  abi: erc20Abi,
                  functionName: 'approve',
                  args: [position.moduleAddress, amount],
                }),
              },
              {
                to: position.moduleAddress,
                data: encodeFunctionData({
                  abi: SolidCashModuleV2_ABI,
                  functionName: 'repay',
                  args: [safe!, tender.token, amount],
                }),
              },
              {
                to: tender.token,
                data: encodeFunctionData({
                  abi: erc20Abi,
                  functionName: 'approve',
                  args: [position.moduleAddress, 0n],
                }),
              },
            );
          }
        }
      }

      calls.push({
        to: position.moduleAddress,
        data: encodeFunctionData({
          abi: SolidCashModuleV2_ABI,
          functionName: 'requestCollateralWithdrawal',
          args: [asset.token, quote.amount],
        }),
      });

      const result = await send(calls, 'Failed to unlock your collateral');
      if (result === USER_CANCELLED_TRANSACTION) {
        track(TRACKING_EVENTS.CARD_CREDIT_UNLOCK_CANCELLED, {
          chain_id: chainId,
          asset: asset.symbol,
        });
        return null;
      }
      track(TRACKING_EVENTS.CARD_CREDIT_UNLOCK_REQUESTED, {
        chain_id: chainId,
        asset: asset.symbol,
        unlock_usd: Number(quote.valueUsd) / 1_000_000,
        repay_usd: Number(quote.repayUsd) / 1_000_000,
        repay_source: quote.repayUsd > 0n ? request.repay.kind : 'none',
        transaction_hash: result.transactionHash,
      });
      return { transactionHash: result.transactionHash, repayUsd: quote.repayUsd };
    },
    onSuccess: result => {
      if (result) refresh();
    },
    onError: (mutationError: Error) => {
      setError(describeFailure(mutationError));
      track(TRACKING_EVENTS.CARD_CREDIT_UNLOCK_FAILED, {
        chain_id: chainId,
        step: 'request',
        error: sanitizeTechnicalMessage(mutationError) || 'Failed to unlock',
      });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async (expected: PendingCollateralUnlock | undefined) => {
      if (!moduleAddress)
        throw new UnlockUserError('Your wallet is still setting up. Please try again shortly.');
      // The module cancels whatever is pending and takes no id, so check it is still the one on
      // screen. This narrows the window to the time between the read and the operation landing.
      const position = await freshPosition();
      if (!position.pendingUnlock) {
        throw new UnlockUserError('There’s no unlock waiting on this loan anymore.');
      }
      requireSamePending(position.pendingUnlock, expected);
      const result = await send(
        [
          {
            to: moduleAddress,
            data: encodeFunctionData({
              abi: SolidCashModuleV2_ABI,
              functionName: 'cancelCollateralWithdrawal',
            }),
          },
        ],
        'Failed to cancel the unlock',
      );
      if (result === USER_CANCELLED_TRANSACTION) return null;
      track(TRACKING_EVENTS.CARD_CREDIT_UNLOCK_WITHDRAWN, {
        chain_id: chainId,
        transaction_hash: result.transactionHash,
      });
      return result;
    },
    onSuccess: result => {
      if (result) refresh();
    },
    onError: (mutationError: Error) => {
      setError(describeFailure(mutationError));
      if (mutationError instanceof UnlockUserError) refresh();
      track(TRACKING_EVENTS.CARD_CREDIT_UNLOCK_FAILED, {
        chain_id: chainId,
        step: 'cancel',
        error: sanitizeTechnicalMessage(mutationError) || 'Failed to cancel',
      });
    },
  });

  const finishMutation = useMutation({
    mutationFn: async (expected: PendingCollateralUnlock | undefined) => {
      const position = await freshPosition();
      const pending = position.pendingUnlock;
      if (!pending) {
        throw new UnlockBlockedError('nothing-pending', 'There’s no unlock waiting on this loan.');
      }
      // `processCollateralWithdrawal` releases whatever is pending; refuse if it is not the one on
      // screen, so the cardholder never signs for an unlock they have not seen.
      requireSamePending(pending, expected);
      if (Math.floor(Date.now() / 1000) < pending.readyAt) {
        throw new UnlockBlockedError('not-ready', 'This unlock isn’t ready yet.');
      }

      // The module's own release check, worked out first so a loan that moved during the wait
      // gets an explanation rather than a reverted operation.
      if (position.debtUsd > 0n) {
        const loan = buildLoan(position, Math.floor(Date.now() / 1000));
        const asset = loan.assets.find(candidate => sameToken(candidate.token, pending.token));
        const value = asset
          ? (pending.amount * asset.priceUsd) / 10n ** BigInt(asset.decimals)
          : 0n;
        const removedPower = asset?.countsTowardPower ? (value * asset.ltvWad) / WAD : 0n;
        if (position.debtUsd > loan.powerUsd - removedPower) {
          throw new UnlockBlockedError(
            'needs-more-cover',
            'Prices moved while you waited, so this loan needs more cover before it can let go.',
          );
        }
      }

      const result = await send(
        [
          {
            to: position.moduleAddress,
            data: encodeFunctionData({
              abi: SolidCashModuleV2_ABI,
              functionName: 'processCollateralWithdrawal',
              args: [safe!],
            }),
          },
        ],
        'Failed to finish the unlock',
      );
      if (result === USER_CANCELLED_TRANSACTION) return null;
      track(TRACKING_EVENTS.CARD_CREDIT_UNLOCK_FINISHED, {
        chain_id: chainId,
        transaction_hash: result.transactionHash,
      });
      return { ...result, token: pending.token, amount: pending.amount };
    },
    onSuccess: result => {
      if (result) refresh();
    },
    onError: (mutationError: Error) => {
      // A loan that needs more cover is explained inline, with its own recovery; every other
      // refusal is said, and the pending state re-read so the screen stops offering it.
      if (
        !(
          mutationError instanceof UnlockBlockedError && mutationError.reason === 'needs-more-cover'
        )
      ) {
        setError(describeFailure(mutationError));
      }
      if (mutationError instanceof UnlockBlockedError || mutationError instanceof UnlockUserError) {
        refresh();
      }
      track(TRACKING_EVENTS.CARD_CREDIT_UNLOCK_FAILED, {
        chain_id: chainId,
        step: 'finish',
        error:
          mutationError instanceof UnlockBlockedError
            ? mutationError.reason
            : sanitizeTechnicalMessage(mutationError) || 'Failed to finish',
      });
    },
  });

  /**
   * With nothing owed, everything still locked comes back at once: `withdrawCollateral` needs no
   * price and no wait at zero debt. Left behind by a repayment that did not take the collateral
   * back in the same signature.
   */
  const withdrawAllMutation = useMutation({
    mutationFn: async (tokens: readonly Address[]) => {
      if (!moduleAddress)
        throw new UnlockUserError('Your wallet is still setting up. Please try again shortly.');
      const result = await send(
        tokens.map(token => ({
          to: moduleAddress,
          data: encodeFunctionData({
            abi: SolidCashModuleV2_ABI,
            functionName: 'withdrawCollateral',
            // Clamped by the module to what is escrowed.
            args: [token, maxUint256],
          }),
        })),
        'Failed to unlock your collateral',
      );
      if (result === USER_CANCELLED_TRANSACTION) return null;
      track(TRACKING_EVENTS.CARD_CREDIT_UNLOCK_FINISHED, {
        chain_id: chainId,
        instant: true,
        transaction_hash: result.transactionHash,
      });
      return result;
    },
    onSuccess: result => {
      if (result) refresh();
    },
    onError: (mutationError: Error) => {
      setError(describeFailure(mutationError));
      track(TRACKING_EVENTS.CARD_CREDIT_UNLOCK_FAILED, {
        chain_id: chainId,
        step: 'withdraw_all',
        error: sanitizeTechnicalMessage(mutationError) || 'Failed to unlock',
      });
    },
  });

  const request = useCallback(
    (input: UnlockRequest) => {
      setError(null);
      track(TRACKING_EVENTS.CARD_CREDIT_UNLOCK_PRESSED, { chain_id: chainId });
      return requestMutation.mutateAsync(input);
    },
    [chainId, requestMutation],
  );
  /** Both take the pending unlock on screen, and refuse if a different one is waiting. */
  const cancel = useCallback(
    (expected?: PendingCollateralUnlock) => {
      setError(null);
      return cancelMutation.mutateAsync(expected);
    },
    [cancelMutation],
  );
  const finish = useCallback(
    (expected?: PendingCollateralUnlock) => {
      setError(null);
      return finishMutation.mutateAsync(expected);
    },
    [finishMutation],
  );

  const withdrawAll = useCallback(
    (tokens: readonly Address[]) => {
      setError(null);
      return withdrawAllMutation.mutateAsync(tokens);
    },
    [withdrawAllMutation],
  );

  return {
    request,
    cancel,
    finish,
    withdrawAll,
    isWithdrawingAll: withdrawAllMutation.isPending,
    isRequesting: requestMutation.isPending,
    isCancelling: cancelMutation.isPending,
    isFinishing: finishMutation.isPending,
    /** The last finish was refused because the loan needs more cover. */
    finishBlocked: finishMutation.error instanceof UnlockBlockedError ? finishMutation.error : null,
    error,
    clearError: useCallback(() => {
      setError(null);
      finishMutation.reset();
    }, [finishMutation]),
  };
}

export default useCollateralUnlock;
