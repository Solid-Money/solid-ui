import BoringQueue_ABI from '@/lib/abis/BoringQueue';
import { ADDRESSES } from '@/lib/config';
import { executeTransactions } from '@/lib/execute';
import { Status } from '@/lib/types';
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
  const [cancelOnchainWithdrawStatus, setCancelOnchainWithdrawStatus] = useState<Status>(
    Status.IDLE,
  );
  const [error, setError] = useState<string | null>(null);

  const cancelOnchainWithdraw = async (requestId: `0x${string}`) => {
    try {
      if (!user) {
        throw new Error('User not found');
      }

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

      const transaction = await executeTransactions(
        smartAccountClient,
        transactions,
        'Cancel onchain withdraw failed',
        mainnet,
      );

      setCancelOnchainWithdrawStatus(Status.SUCCESS);
      return transaction;
    } catch (error) {
      console.error(error);
      setCancelOnchainWithdrawStatus(Status.ERROR);
      setError(error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  };

  return { cancelOnchainWithdraw, cancelOnchainWithdrawStatus, error };
};

export default useCancelOnchainWithdraw;
