import { useCallback, useState } from 'react';
import * as Sentry from '@sentry/react-native';
import { erc20Abi, TransactionReceipt } from 'viem';
import { fuse } from 'viem/chains';
import { encodeFunctionData, parseUnits } from 'viem/utils';

import { WRAPPED_FUSE } from '@/constants/addresses';
import { useActivity } from '@/hooks/useActivity';
import BoringQueue_ABI from '@/lib/abis/BoringQueue';
import { ADDRESSES } from '@/lib/config';
import { executeTransactions, USER_CANCELLED_TRANSACTION } from '@/lib/execute';
import { Status, TransactionType } from '@/lib/types';

import useUser from './useUser';

type WithdrawSoFuseResult = {
  withdrawSoFuse: (amount: string) => Promise<TransactionReceipt>;
  withdrawSoFuseStatus: Status;
  error: string | null;
};

const useWithdrawSoFuse = (): WithdrawSoFuseResult => {
  const { user, safeAA } = useUser();
  const { trackTransaction } = useActivity();
  const [withdrawSoFuseStatus, setWithdrawSoFuseStatus] = useState<Status>(Status.IDLE);
  const [error, setError] = useState<string | null>(null);

  const withdrawSoFuse = useCallback(
    async (amount: string) => {
      const amountWei = parseUnits(amount, 18);
      try {
        if (!user) {
          throw new Error('User not found');
        }

        setWithdrawSoFuseStatus(Status.PENDING);
        setError(null);

        const transactions = [
          {
            to: ADDRESSES.fuse.fuseVault,
            data: encodeFunctionData({
              abi: erc20Abi,
              functionName: 'approve',
              args: [ADDRESSES.fuse.soFuseBoringQueue, amountWei],
            }),
            value: 0n,
          },
          {
            to: ADDRESSES.fuse.soFuseBoringQueue,
            data: encodeFunctionData({
              abi: BoringQueue_ABI,
              functionName: 'requestOnChainWithdraw',
              args: [WRAPPED_FUSE, amountWei, 1, 260000],
            }),
            value: 0n,
          },
        ];

        const smartAccountClient = await safeAA(fuse, user.suborgId, user.signWith);

        const result = await trackTransaction(
          {
            type: TransactionType.WITHDRAW,
            title: `Withdraw ${amount} soFUSE`,
            shortTitle: `Withdraw ${amount}`,
            amount,
            symbol: 'soFUSE',
            chainId: fuse.id,
            fromAddress: user.safeAddress,
            toAddress: ADDRESSES.fuse.fuseVault,
            metadata: {
              description: `Withdraw ${amount} soFUSE to WFUSE on Fuse`,
              tokenAddress: ADDRESSES.fuse.fuseVault,
            },
          },
          onUserOpHash =>
            executeTransactions(
              smartAccountClient,
              transactions,
              'Withdraw soFUSE failed',
              fuse,
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

        setWithdrawSoFuseStatus(Status.SUCCESS);
        return transaction;
      } catch (err) {
        console.error(err);
        setWithdrawSoFuseStatus(Status.ERROR);
        setError(err instanceof Error ? err.message : 'Unknown error');
        Sentry.captureException(err, {
          tags: { type: 'withdraw_sofuse_error' },
          extra: { amount, userAddress: user?.safeAddress },
        });
        throw err;
      }
    },
    [user, safeAA, trackTransaction],
  );

  return { withdrawSoFuse, withdrawSoFuseStatus, error };
};

export default useWithdrawSoFuse;
