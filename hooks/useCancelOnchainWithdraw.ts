import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { TransactionReceipt } from 'viem';
import { mainnet } from 'viem/chains';
import { encodeFunctionData } from 'viem/utils';

import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { useActivityActions } from '@/hooks/useActivityActions';
import { BASE_WITHDRAW_REQUEST } from '@/hooks/useBaseWithdrawRequests';
import BoringQueue_ABI from '@/lib/abis/BoringQueue';
import { track } from '@/lib/analytics';
import { executeTransactions, USER_CANCELLED_TRANSACTION } from '@/lib/execute';
import { getSoUsdWithdrawChain, SOUSD_WITHDRAW_CHAINS } from '@/lib/soUsdWithdraw';
import { Status, TransactionType } from '@/lib/types';

import useUser from './useUser';

type CancelOnChainWithdrawResult = {
  /**
   * `chainId` is the chain the request was queued on; requests made before soUSD
   * moved to Base, and any activity without a chain, are on Ethereum.
   */
  cancelOnchainWithdraw: (
    requestId: `0x${string}`,
    chainId?: number,
  ) => Promise<TransactionReceipt>;
  cancelOnchainWithdrawStatus: Status;
  error: string | null;
};

const useCancelOnchainWithdraw = (): CancelOnChainWithdrawResult => {
  const { user, safeAA } = useUser();
  const { trackTransaction } = useActivityActions();
  const queryClient = useQueryClient();
  const [cancelOnchainWithdrawStatus, setCancelOnchainWithdrawStatus] = useState<Status>(
    Status.IDLE,
  );
  const [error, setError] = useState<string | null>(null);

  const cancelOnchainWithdraw = async (requestId: `0x${string}`, chainId?: number) => {
    const { chain, vault, boringQueue } =
      SOUSD_WITHDRAW_CHAINS[getSoUsdWithdrawChain(chainId) ?? mainnet.id];
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
        chain_id: chain.id,
        source: 'useCancelOnchainWithdraw',
      });

      setCancelOnchainWithdrawStatus(Status.PENDING);
      setError(null);

      let transactions = [];

      // Add cancel onchain withdraw transaction
      transactions.push({
        to: boringQueue,
        data: encodeFunctionData({
          abi: BoringQueue_ABI,
          functionName: 'cancelOnChainWithdrawUsingRequestId',
          args: [requestId],
        }),
        value: 0n,
      });

      const smartAccountClient = await safeAA(chain, user.suborgId, user.signWith);

      const result = await trackTransaction(
        {
          type: TransactionType.CANCEL_WITHDRAW,
          title: 'Cancel onchain withdraw',
          shortTitle: 'Cancel withdraw',
          amount: '0',
          symbol: 'soUSD',
          chainId: chain.id,
          fromAddress: user.safeAddress,
          toAddress: boringQueue,
          metadata: {
            description: 'Cancel onchain withdraw request',
            requestId,
            tokenAddress: vault,
          },
        },
        onUserOpHash =>
          executeTransactions(
            smartAccountClient,
            transactions,
            'Cancel onchain withdraw failed',
            chain,
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
        chain_id: chain.id,
        source: 'useCancelOnchainWithdraw',
      });

      // A Base request's status is read from the queue; re-read it now rather
      // than on the next poll, so the withdraw shows as cancelled at once.
      void queryClient.invalidateQueries({ queryKey: [BASE_WITHDRAW_REQUEST] }).catch(() => {});

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
