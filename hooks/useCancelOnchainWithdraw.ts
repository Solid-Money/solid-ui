import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { useActivity } from '@/hooks/useActivity';
import BoringQueue_ABI from '@/lib/abis/BoringQueue';
import { track } from '@/lib/analytics';
import { ADDRESSES } from '@/lib/config';
import { executeTransactions, USER_CANCELLED_TRANSACTION } from '@/lib/execute';
import { Status, TransactionType } from '@/lib/types';
import { useState } from 'react';
import { TransactionReceipt } from 'viem';
import { mainnet } from 'viem/chains';
import { encodeFunctionData } from 'viem/utils';
import useUser from './useUser';

type CancelOnChainWithdrawResult = {
  cancelOnchainWithdraw: (requestId: `0x${string}`) => Promise<TransactionReceipt>;
  cancelOnchainWithdrawStatus: Status;
  error: string | null;
};

const useCancelOnchainWithdraw = (): CancelOnChainWithdrawResult => {
  const { user, safeAA } = useUser();
  const { trackTransaction } = useActivity();
  const [cancelOnchainWithdrawStatus, setCancelOnchainWithdrawStatus] = useState<Status>(
    Status.IDLE,
  );
  const [error, setError] = useState<string | null>(null);

  const cancelOnchainWithdraw = async (requestId: `0x${string}`) => {
    try {
      if (!user) {
        track(TRACKING_EVENTS.CANCEL_WITHDRAW_ERROR, {
          request_id: requestId,
          error: 'User not found',
          step: 'validation',
          source: 'useCancelOnchainWithdraw',
        });
        throw new Error('User not found');
      }

      track(TRACKING_EVENTS.CANCEL_WITHDRAW_INITIATED, {
        request_id: requestId,
        chain_id: mainnet.id,
        source: 'useCancelOnchainWithdraw',
      });

      setCancelOnchainWithdrawStatus(Status.PENDING);
      setError(null);

      let transactions = [];

      // Add cancel onchain withdraw transaction
      transactions.push({
        to: ADDRESSES.ethereum.boringQueue,
        data: encodeFunctionData({
          abi: BoringQueue_ABI,
          functionName: 'cancelOnChainWithdrawUsingRequestId',
          args: [requestId],
        }),
        value: 0n,
      });

      const smartAccountClient = await safeAA(mainnet, user.suborgId, user.signWith);

      const result = await trackTransaction(
        {
          type: TransactionType.CANCEL_WITHDRAW,
          title: 'Cancel onchain withdraw',
          shortTitle: 'Cancel withdraw',
          amount: '0',
          symbol: 'soUSD',
          chainId: mainnet.id,
          fromAddress: user.safeAddress,
          toAddress: ADDRESSES.ethereum.boringQueue,
          metadata: {
            description: 'Cancel onchain withdraw request',
            requestId,
            tokenAddress: ADDRESSES.ethereum.vault,
          },
        },
        onUserOpHash =>
          executeTransactions(
            smartAccountClient,
            transactions,
            'Cancel onchain withdraw failed',
            mainnet,
            onUserOpHash,
          ),
      );

      const transaction =
        result && typeof result === 'object' && 'transaction' in result
          ? result.transaction
          : result;

      if (transaction === USER_CANCELLED_TRANSACTION) {
        track(TRACKING_EVENTS.CANCEL_WITHDRAW_CANCELLED, {
          request_id: requestId,
          source: 'useCancelOnchainWithdraw',
        });
        throw new Error('User cancelled transaction');
      }

      track(TRACKING_EVENTS.CANCEL_WITHDRAW_COMPLETED, {
        request_id: requestId,
        transaction_hash: transaction.transactionHash,
        chain_id: mainnet.id,
        source: 'useCancelOnchainWithdraw',
      });

      setCancelOnchainWithdrawStatus(Status.SUCCESS);
      return transaction;
    } catch (error) {
      console.error(error);

      track(TRACKING_EVENTS.CANCEL_WITHDRAW_ERROR, {
        request_id: requestId,
        error: error instanceof Error ? error.message : 'Unknown error',
        user_cancelled: String(error).includes('cancelled'),
        step: 'execution',
        source: 'useCancelOnchainWithdraw',
      });

      setCancelOnchainWithdrawStatus(Status.ERROR);
      setError(error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  };

  return { cancelOnchainWithdraw, cancelOnchainWithdrawStatus, error };
};

export default useCancelOnchainWithdraw;
