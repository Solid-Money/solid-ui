import { useCallback, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { minutesToMilliseconds, secondsToMilliseconds } from 'date-fns';
import { Address, erc20Abi } from 'viem';
import { fuse, mainnet } from 'viem/chains';
import { useReadContract } from 'wagmi';

import { USDC_STARGATE } from '@/constants/addresses';
import AccountantAbi from '@/lib/abis/Accountant';
import { confirmOnboardingFee, fetchOnboardingFeeQuote } from '@/lib/api';
import { ADDRESSES } from '@/lib/config';
import { executeTransactions, USER_CANCELLED_TRANSACTION } from '@/lib/execute';
import { ConfirmOnboardingFeeParams, OnboardingFeeProduct } from '@/lib/types';
import { withRefreshToken } from '@/lib/utils';
import {
  assetBalanceUsd,
  buildFeeTransfer,
  FeePayment,
  FeePaymentAsset,
  selectFeePayment,
} from '@/lib/utils/onboardingFee';
import {
  clearPendingPayment,
  describePaymentError,
  describePaymentFailure,
  getPendingPayment,
  PendingPayment,
  setPendingPayment,
} from '@/lib/utils/onboardingFeeRetry';
import { useUserStore } from '@/store/useUserStore';

import useUser from './useUser';

const ONBOARDING_FEE = 'onboardingFee';

/**
 * The fee is paid on Fuse, and only on Fuse.
 *
 * Gas is sponsored there, so the user signs once and pays nothing extra — and
 * both assets below are ones the server can price exactly on Fuse (soUSD
 * through the vault accountant, USDC through its token list). The server also
 * accepts mainnet, for support and manual payments, but the app never builds
 * one: a mainnet payment would cost the user gas to pay a $10 fee.
 */
const FEE_CHAIN = fuse;

/** soUSD's accountant rate is quoted to 6 decimals, like the share itself. */
const SOUSD_RATE_DECIMALS = 6;

const useSelectedUserId = () =>
  useUserStore(state => state.users.find(user => user.selected)?.userId);

/**
 * What this user owes to open a Rain product, and whether they have paid.
 *
 * Short-lived rather than per-session: the fee is configured per country and
 * can be switched off entirely, so a stale quote is a sheet asking for money
 * nobody is collecting. Keyed by user id for the same reason the fee-rate query
 * is — the endpoint carries no address, so one cache entry would otherwise be
 * shared across accounts.
 */
export const useOnboardingFeeQuote = (product: OnboardingFeeProduct, enabled = true) => {
  const userId = useSelectedUserId();

  return useQuery({
    queryKey: [ONBOARDING_FEE, 'quote', product, userId],
    queryFn: async () => withRefreshToken(() => fetchOnboardingFeeQuote(product)),
    staleTime: secondsToMilliseconds(30),
    gcTime: minutesToMilliseconds(5),
    enabled: Boolean(userId) && enabled,
  });
};

/** Credit a payment the user has already made on chain. */
export const useConfirmOnboardingFee = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: ConfirmOnboardingFeeParams) =>
      withRefreshToken(() => confirmOnboardingFee(params)),
    onSuccess: () => {
      // The quote carries `satisfied`, which every gate downstream reads.
      void queryClient.invalidateQueries({ queryKey: [ONBOARDING_FEE] });
    },
  });
};

export type FeePaymentPhase = 'idle' | 'paying' | 'confirming' | 'paid';

export interface OnboardingFeePayment {
  /** The server's quote. Undefined until it loads. */
  feeUsd: number | undefined;
  /** True when nothing is left to pay — settled, or never owed. */
  satisfied: boolean;
  /** Which asset would be spent, and how much of it. */
  payment: FeePayment | undefined;
  /** Everything the user could pay with, for the "available" line. */
  availableUsd: number;
  /** True when the quote is known and nothing covers it. */
  insufficientFunds: boolean;
  isLoading: boolean;
  phase: FeePaymentPhase;
  error: string | null;
  /** Pay, then credit it. Resolves true once the fee is settled. */
  pay: () => Promise<boolean>;
}

/**
 * Paying the one-time setup fee, end to end.
 *
 * The transfer and the confirmation are deliberately two steps with the chain
 * in between: the user's money moves first, and the server then reads that
 * transfer back before it credits anything. A failure to confirm is therefore
 * recoverable — the payment exists on chain, and retrying `pay` on a fee that
 * is already settled is answered by the server with "already paid" rather than
 * charging again.
 */
export const useOnboardingFeePayment = (
  product: OnboardingFeeProduct,
  enabled = true,
): OnboardingFeePayment => {
  const { user, safeAA } = useUser();
  const safeAddress = user?.safeAddress as Address | undefined;

  const { data: quote, isLoading: isLoadingQuote } = useOnboardingFeeQuote(product, enabled);
  const { mutateAsync: confirm } = useConfirmOnboardingFee();

  const [phase, setPhase] = useState<FeePaymentPhase>('idle');
  const [error, setError] = useState<string | null>(null);

  const owes = Boolean(quote && !quote.satisfied && quote.feeUsd > 0);
  const canRead = Boolean(safeAddress) && enabled;

  const { data: soUsdBalance, isLoading: isLoadingSoUsd } = useReadContract({
    abi: erc20Abi,
    address: ADDRESSES.fuse.vault,
    functionName: 'balanceOf',
    args: [safeAddress as Address],
    chainId: FEE_CHAIN.id,
    query: { enabled: canRead },
  });

  const { data: usdcBalance, isLoading: isLoadingUsdc } = useReadContract({
    abi: erc20Abi,
    address: USDC_STARGATE,
    functionName: 'balanceOf',
    args: [safeAddress as Address],
    chainId: FEE_CHAIN.id,
    query: { enabled: canRead },
  });

  // soUSD is a vault share, so a dollar of it is not a share of it. The
  // accountant is the same source the savings screen and the balance list
  // price it from, so the sheet cannot disagree with the rest of the app.
  const { data: soUsdRateRaw, isLoading: isLoadingRate } = useReadContract({
    abi: AccountantAbi,
    address: ADDRESSES.ethereum.accountant,
    functionName: 'getRate',
    chainId: mainnet.id,
    query: { enabled: canRead },
  });

  const soUsdRate = useMemo(() => {
    if (typeof soUsdRateRaw !== 'bigint') return undefined;
    const rate = Number(soUsdRateRaw) / 10 ** SOUSD_RATE_DECIMALS;
    return Number.isFinite(rate) && rate > 0 ? rate : undefined;
  }, [soUsdRateRaw]);

  /**
   * What the user can pay with, in preference order.
   *
   * soUSD first: it is where a Solid balance normally sits, and spending USDC
   * first would drain the asset the card and the onramp flows expect to find.
   * soUSD is omitted entirely while its rate is unknown rather than priced at
   * 1:1 — guessing the rate low overpays the user's money, guessing it high
   * sends a transfer the server values under the fee.
   */
  const assets = useMemo<FeePaymentAsset[]>(() => {
    const list: FeePaymentAsset[] = [];

    if (typeof soUsdBalance === 'bigint' && soUsdRate) {
      list.push({
        tokenAddress: ADDRESSES.fuse.vault,
        symbol: 'soUSD',
        decimals: 6,
        balance: soUsdBalance,
        usdPerToken: soUsdRate,
      });
    }

    if (typeof usdcBalance === 'bigint') {
      list.push({
        tokenAddress: USDC_STARGATE,
        symbol: 'USDC',
        decimals: 6,
        balance: usdcBalance,
        usdPerToken: 1,
      });
    }

    return list;
  }, [soUsdBalance, soUsdRate, usdcBalance]);

  const availableUsd = useMemo(
    () => assets.reduce((total, asset) => total + assetBalanceUsd(asset), 0),
    [assets],
  );

  const payment = useMemo(
    () => (quote ? selectFeePayment(quote.feeUsd, assets) : undefined),
    [assets, quote],
  );

  const isLoading =
    isLoadingQuote || (canRead && owes && (isLoadingSoUsd || isLoadingUsdc || isLoadingRate));

  /**
   * Credit a payment that is already on chain.
   *
   * Clears the pending record only on success, or on a refusal the server will
   * keep giving — a transient failure must leave it in place so the next press
   * re-confirms this payment instead of making another one.
   */
  const settle = useCallback(
    async (attempt: PendingPayment): Promise<boolean> => {
      setPhase('confirming');
      try {
        const confirmed = await confirm({
          product,
          transactionHash: attempt.transactionHash,
          chainId: attempt.chainId,
        });

        if (!confirmed.satisfied) {
          setPhase('idle');
          setError('We could not confirm your payment. Please contact support.');
          return false;
        }

        clearPendingPayment(product);
        setPhase('paid');
        return true;
      } catch (caught) {
        const { message, retryable } = await describePaymentFailure(caught);

        // A settled refusal — the transaction genuinely does not pay this fee,
        // or has already been used. Re-confirming it will never succeed, so the
        // record is dropped and the user can choose to pay again. Deliberately
        // their choice: we do not spend their money a second time on their
        // behalf after telling them the first one failed.
        if (!retryable) clearPendingPayment(product);

        setPhase('idle');
        setError(message);
        return false;
      }
    },
    [confirm, product],
  );

  const pay = useCallback(async (): Promise<boolean> => {
    setError(null);

    if (quote?.satisfied) {
      setPhase('paid');
      return true;
    }

    if (!quote || !user || !safeAddress) {
      setError('Your account is still loading. Please try again in a moment.');
      return false;
    }

    // A payment is already on chain and simply was not credited — confirm THAT
    // one rather than sending more money. The transfer is the irreversible
    // half; re-running it because our own bookkeeping call failed is how a user
    // ends up paying twice for one fee.
    //
    // Checked BEFORE anything that reasons about the balance, and that order is
    // the whole point: paying the fee is what takes the money, so the balance
    // of a user with a pending payment is usually no longer enough to cover it.
    // Asking "can you afford this?" first would answer "add funds" to someone
    // who has already paid.
    const pending = getPendingPayment(product);
    if (pending) {
      return await settle(pending);
    }

    const transfer =
      payment &&
      buildFeeTransfer({
        treasuryAddress: quote.treasuryAddress,
        tokenAddress: payment.asset.tokenAddress,
        amount: payment.amount,
      });

    if (!payment || !transfer) {
      // Either nothing covers the fee, or no treasury is configured. Both are
      // "do not build a transfer": one would revert, the other would send the
      // user's money somewhere that does not pay the fee.
      setError(
        payment
          ? 'Payments are temporarily unavailable. Please try again shortly.'
          : 'Add funds to your account to pay the setup fee.',
      );
      return false;
    }

    setPhase('paying');
    try {
      const smartAccountClient = await safeAA(FEE_CHAIN, user.suborgId, user.signWith);
      const result = await executeTransactions(
        smartAccountClient,
        [transfer],
        'Setup fee payment failed',
        FEE_CHAIN,
      );

      if (result === USER_CANCELLED_TRANSACTION) {
        setPhase('idle');
        return false;
      }

      const transactionHash =
        result && typeof result === 'object' && 'transactionHash' in result
          ? (result as { transactionHash: string }).transactionHash
          : undefined;

      if (!transactionHash) {
        // Nothing to confirm against. The transfer may still have landed, so
        // this says "we could not confirm" rather than "it failed" — a retry
        // re-reads the quote and settles if it did.
        setPhase('idle');
        setError('We could not confirm your payment. Please try again.');
        return false;
      }

      // Recorded BEFORE the confirmation is attempted, so a failure anywhere
      // below leaves a record of money that has already moved.
      const attempt: PendingPayment = { transactionHash, chainId: FEE_CHAIN.id };
      setPendingPayment(product, attempt);

      return await settle(attempt);
    } catch (caught) {
      setPhase('idle');
      setError(await describePaymentError(caught));
      return false;
    }
  }, [payment, product, quote, safeAA, safeAddress, settle, user]);

  return {
    feeUsd: quote?.feeUsd,
    satisfied: Boolean(quote?.satisfied),
    payment,
    availableUsd,
    insufficientFunds: Boolean(quote) && owes && !payment && !isLoading,
    isLoading,
    phase,
    error,
    pay,
  };
};

/**
 * A message for the user out of whatever the payment threw.
 *
 * The API layer rejects with the `Response` itself, so the server's own reason
 * — "that transaction did not pay the setup fee", "that payment has already
 * been used" — is in the body and is the most useful thing we can say. Anything
 * unreadable falls back to a generic line rather than surfacing a status code.
 */
