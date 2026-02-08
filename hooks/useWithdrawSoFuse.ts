import { useActivity } from '@/hooks/useActivity';
import FuseVault from '@/lib/abis/FuseVault';
import { ADDRESSES } from '@/lib/config';
import { executeTransactions, USER_CANCELLED_TRANSACTION } from '@/lib/execute';
import { Status, TransactionType } from '@/lib/types';
import * as Sentry from '@sentry/react-native';
import { Address } from 'abitype';
import { useCallback, useState } from 'react';
import { TransactionReceipt } from 'viem';
import { fuse } from 'viem/chains';
import { encodeFunctionData, parseUnits } from 'viem/utils';

import { WRAPPED_FUSE } from '@/constants/addresses';
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
      try {
        if (!user) {
          throw new Error('User not found');
        }

        setWithdrawSoFuseStatus(Status.PENDING);
        setError(null);

        const shareAmount = parseUnits(amount, 18);
        const userAddress = user.safeAddress as Address;
        const minAssetAmount = 0n;

        const transactions = [
          {
            to: ADDRESSES.fuse.fuseVault,
            data: encodeFunctionData({
              abi: FuseVault,
              functionName: 'exit',
              args: [
                userAddress,
                WRAPPED_FUSE,
                minAssetAmount,
                userAddress,
                shareAmount,
              ],
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
              description: `Withdraw ${amount} soFUSE to FUSE on Fuse`,
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
