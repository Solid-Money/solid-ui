import { useState } from 'react';
import * as Sentry from '@sentry/react-native';
import { Address } from 'abitype';
import { erc20Abi, maxUint256, TransactionReceipt } from 'viem';
import { mainnet } from 'viem/chains';
import { encodeFunctionData, parseUnits } from 'viem/utils';
import { useReadContract } from 'wagmi';

import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { useActivityActions } from '@/hooks/useActivityActions';
import BoringQueue_ABI from '@/lib/abis/BoringQueue';
import { track } from '@/lib/analytics';
import { ADDRESSES } from '@/lib/config';
import { executeTransactions, USER_CANCELLED_TRANSACTION } from '@/lib/execute';
import { Status, TransactionType } from '@/lib/types';

import useUser from './useUser';

type WithdrawResult = {
  withdraw: (amount: string) => Promise<TransactionReceipt>;
  withdrawStatus: Status;
  error: string | null;
};

const useWithdraw = (): WithdrawResult => {
  const { user, safeAA } = useUser();
  const { trackTransaction } = useActivityActions();
  const [withdrawStatus, setWithdrawStatus] = useState<Status>(Status.IDLE);
  const [error, setError] = useState<string | null>(null);

  const { data: allowance } = useReadContract({
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
    const needsApproval = (allowance as bigint) < amountWei;

    try {
      if (!user) {
        throw new Error('User not found');
      }

      track(TRACKING_EVENTS.WITHDRAW_TRANSACTION_INITIATED, {
        amount: amount,
        needs_approval: needsApproval,
        allowance: allowance?.toString(),
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

      setWithdrawStatus(Status.SUCCESS);
      return transaction;
    } catch (error) {
      console.error(error);

      track(TRACKING_EVENTS.WITHDRAW_TRANSACTION_ERROR, {
        amount: amount,
        allowance: allowance?.toString(),
        needs_approval: needsApproval,
        error_message: error instanceof Error ? error.message : 'Unknown error',
        user_cancelled: String(error).includes('cancelled'),
        source: 'withdraw_hook',
      });

      Sentry.captureException(error, {
        tags: {
          type: 'withdraw_error',
          userId: user?.userId,
        },
        extra: {
          amount,
          allowance: allowance?.toString(),
          userAddress: user?.safeAddress,
        },
        user: {
          id: user?.userId,
          address: user?.safeAddress,
        },
      });
      setWithdrawStatus(Status.ERROR);
      setError(error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  };

  return { withdraw, withdrawStatus, error };
};

export default useWithdraw;
