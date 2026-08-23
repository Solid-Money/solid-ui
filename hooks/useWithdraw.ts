import { useState } from 'react';
import * as Sentry from '@sentry/react-native';
import { useQueryClient } from '@tanstack/react-query';
import { Address } from 'abitype';
import { erc20Abi, maxUint256, TransactionReceipt } from 'viem';
import { mainnet } from 'viem/chains';
import { encodeFunctionData, parseUnits } from 'viem/utils';
import { useReadContract } from 'wagmi';

import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { useActivityActions } from '@/hooks/useActivityActions';
import { VAULT } from '@/hooks/useVault';
import BoringQueue_ABI from '@/lib/abis/BoringQueue';
import { track } from '@/lib/analytics';
import { ADDRESSES } from '@/lib/config';
import { executeTransactions, USER_CANCELLED_TRANSACTION } from '@/lib/execute';
import { Status, TransactionType } from '@/lib/types';
import {
  decodeRevertReason,
  describeWithdrawError,
  isUserCancelledError,
} from '@/lib/utils/withdrawErrors';

import useUser from './useUser';

type WithdrawResult = {
  withdraw: (amount: string) => Promise<TransactionReceipt>;
  withdrawStatus: Status;
  error: string | null;
  /** True while the on-chain approval check is in flight; submitting is unsafe until it settles. */
  isAllowanceLoading: boolean;
};

const useWithdraw = (): WithdrawResult => {
  const { user, safeAA } = useUser();
  const { trackTransaction } = useActivityActions();
  const queryClient = useQueryClient();
  const [withdrawStatus, setWithdrawStatus] = useState<Status>(Status.IDLE);
  const [error, setError] = useState<string | null>(null);

  const {
    data: allowance,
    isLoading: isAllowanceLoading,
    refetch: refetchAllowance,
  } = useReadContract({
    abi: erc20Abi,
    address: ADDRESSES.ethereum.vault,
    functionName: 'allowance',
    args: [user?.safeAddress as Address, ADDRESSES.ethereum.boringQueue],
    chainId: mainnet.id,
    query: {
      enabled: !!user?.safeAddress,
    },
  });

  const withdraw = async (amount: string) => {
    const amountWei = parseUnits(amount, 6);
    // Resolved below, before anything is signed. Declared here so the catch
    // block can still report what we knew at the time.
    let currentAllowance = allowance;
    let needsApproval = false;

    try {
      if (!user) {
        throw new Error('User not found');
      }

      // `allowance` is undefined until the read resolves, and `undefined < amountWei`
      // is false — so the old check read a pending query as "already approved",
      // skipped the approve leg, and left the queue's transferFrom to revert with
      // TRANSFER_FROM_FAILED. Never infer approval from a missing read: fetch it,
      // and refuse to sign anything if it still cannot be had.
      if (currentAllowance === undefined) {
        currentAllowance = (await refetchAllowance()).data;
      }
      if (currentAllowance === undefined) {
        throw new Error('Could not check your withdrawal approval. Please try again.');
      }

      needsApproval = currentAllowance < amountWei;

      track(TRACKING_EVENTS.WITHDRAW_TRANSACTION_INITIATED, {
        amount: amount,
        needs_approval: needsApproval,
        allowance: currentAllowance.toString(),
        source: 'withdraw_hook',
      });

      setWithdrawStatus(Status.PENDING);
      setError(null);

      let transactions = [];

      if (needsApproval) {
        transactions.push({
          to: ADDRESSES.ethereum.vault,
          data: encodeFunctionData({
            abi: erc20Abi,
            functionName: 'approve',
            args: [ADDRESSES.ethereum.boringQueue, maxUint256],
          }),
          value: 0n,
        });
      }

      // Add deposit transaction
      transactions.push({
        to: ADDRESSES.ethereum.boringQueue,
        data: encodeFunctionData({
          abi: BoringQueue_ABI,
          functionName: 'requestOnChainWithdraw',
          args: [ADDRESSES.ethereum.usdc, amountWei, 1, 260000],
        }),
        value: 0n,
      });

      const smartAccountClient = await safeAA(mainnet, user.suborgId, user.signWith);

      const result = await trackTransaction(
        {
          type: TransactionType.WITHDRAW,
          title: `Withdraw ${amount} soUSD`,
          shortTitle: `Withdraw ${amount}`,
          amount,
          symbol: 'soUSD',
          chainId: mainnet.id,
          fromAddress: user.safeAddress,
          toAddress: ADDRESSES.ethereum.boringQueue,
          metadata: {
            description: `Withdraw ${amount} soUSD`,
            needsApproval,
            tokenAddress: ADDRESSES.ethereum.vault,
          },
        },
        onUserOpHash =>
          executeTransactions(
            smartAccountClient,
            transactions,
            'Withdraw failed',
            mainnet,
            onUserOpHash,
          ),
      );

      const transaction =
        result && typeof result === 'object' && 'transaction' in result
          ? result.transaction
          : result;

      if (transaction === USER_CANCELLED_TRANSACTION) {
        throw new Error('User cancelled transaction');
      }

      track(TRACKING_EVENTS.WITHDRAW_TRANSACTION_COMPLETED, {
        amount: amount,
        needs_approval: needsApproval,
        transaction_hash: transaction.transactionHash,
        source: 'withdraw_hook',
      });

      // Requesting a withdrawal moves the shares into the queue, so the cached
      // vault balance is now too high — and it is what "Max" fills in. Left
      // stale, a second attempt asks for shares the account no longer holds and
      // reverts TRANSFER_FROM_FAILED, identically, for as long as the user keeps
      // retrying. The allowance is also spent down when it was not infinite.
      //
      // Deliberately not awaited, and swallowed: the withdrawal has already been
      // submitted, so a cache refresh that fails must not fall into the catch
      // below and report a completed withdrawal as an error.
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: [VAULT] }),
        refetchAllowance(),
      ]).catch(() => {});

      setWithdrawStatus(Status.SUCCESS);
      return transaction;
    } catch (error) {
      console.error(error);

      const revertReason = decodeRevertReason(
        error instanceof Error ? error.message : String(error ?? ''),
      );

      track(TRACKING_EVENTS.WITHDRAW_TRANSACTION_ERROR, {
        amount: amount,
        allowance: currentAllowance?.toString(),
        needs_approval: needsApproval,
        error_message: error instanceof Error ? error.message : 'Unknown error',
        // The raw message carries the reason only as hex, which groups every
        // distinct revert under one unreadable blob in analytics.
        revert_reason: revertReason,
        user_cancelled: isUserCancelledError(error),
        source: 'withdraw_hook',
      });

      Sentry.captureException(error, {
        tags: {
          type: 'withdraw_error',
          userId: user?.userId,
          revert_reason: revertReason,
        },
        extra: {
          amount,
          allowance: currentAllowance?.toString(),
          needsApproval,
          userAddress: user?.safeAddress,
        },
        user: {
          id: user?.userId,
          address: user?.safeAddress,
        },
      });
      setWithdrawStatus(Status.ERROR);
      setError(describeWithdrawError(error));
      throw error;
    }
  };

  return { withdraw, withdrawStatus, error, isAllowanceLoading };
};

export default useWithdraw;
