import { useCallback, useState } from 'react';
import * as Sentry from '@sentry/react-native';
import { erc20Abi, TransactionReceipt } from 'viem';
import { base } from 'viem/chains';
import { encodeFunctionData, parseUnits } from 'viem/utils';

import { WITHDRAW_SECONDS_TO_DEADLINE } from '@/constants/withdraw';
import { useActivityActions } from '@/hooks/useActivityActions';
import BoringQueue_ABI from '@/lib/abis/BoringQueue';
import { ADDRESSES } from '@/lib/config';
import { SOEURC_DECIMALS, SOEURC_DEPOSIT_ASSET } from '@/lib/deposit/soEurc';
import { executeTransactions, USER_CANCELLED_TRANSACTION } from '@/lib/execute';
import { Status, TransactionType } from '@/lib/types';

import useUser from './useUser';

/**
 * Discount, in basis points, the request offers the solver: the queue's minimum
 * for EURC (it accepts 1-100). The same 0.01% the withdraw form quotes.
 */
const SOEURC_WITHDRAW_DISCOUNT_BPS = 1;

type WithdrawSoEurcResult = {
  withdrawSoEurc: (amount: string) => Promise<TransactionReceipt>;
  withdrawSoEurcStatus: Status;
  error: string | null;
};

/**
 * soEURC → EURC on Base, in one step: the Safe approves the soEURC on-chain queue
 * for the shares and requests the withdrawal there. A solver fills it after the
 * queue's maturity; the EURC lands in the Safe on Base. The request must stay
 * open at least the queue's three-day minimum, which the 7-day deadline covers.
 */
const useWithdrawSoEurc = (): WithdrawSoEurcResult => {
  const { user, safeAA } = useUser();
  const { trackTransaction } = useActivityActions();
  const [withdrawSoEurcStatus, setWithdrawSoEurcStatus] = useState<Status>(Status.IDLE);
  const [error, setError] = useState<string | null>(null);

  const withdrawSoEurc = useCallback(
    async (amount: string) => {
      const amountWei = parseUnits(amount, SOEURC_DECIMALS);
      try {
        if (!user) {
          throw new Error('User not found');
        }

        setWithdrawSoEurcStatus(Status.PENDING);
        setError(null);

        const transactions = [
          {
            to: ADDRESSES.base.soEurcVault,
            data: encodeFunctionData({
              abi: erc20Abi,
              functionName: 'approve',
              args: [ADDRESSES.base.soEurcBoringQueue, amountWei],
            }),
            value: 0n,
          },
          {
            to: ADDRESSES.base.soEurcBoringQueue,
            data: encodeFunctionData({
              abi: BoringQueue_ABI,
              functionName: 'requestOnChainWithdraw',
              args: [
                SOEURC_DEPOSIT_ASSET,
                amountWei,
                SOEURC_WITHDRAW_DISCOUNT_BPS,
                WITHDRAW_SECONDS_TO_DEADLINE,
              ],
            }),
            value: 0n,
          },
        ];

        const smartAccountClient = await safeAA(base, user.suborgId, user.signWith);

        const result = await trackTransaction(
          {
            type: TransactionType.WITHDRAW,
            title: `Withdraw ${amount} soEURC`,
            shortTitle: `Withdraw ${amount}`,
            amount,
            symbol: 'soEURC',
            chainId: base.id,
            fromAddress: user.safeAddress,
            toAddress: ADDRESSES.base.soEurcBoringQueue,
            metadata: {
              description: `Withdraw ${amount} soEURC to EURC on Base`,
              tokenAddress: ADDRESSES.base.soEurcVault,
            },
          },
          onUserOpHash =>
            executeTransactions(
              smartAccountClient,
              transactions,
              'Withdraw soEURC failed',
              base,
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

        setWithdrawSoEurcStatus(Status.SUCCESS);
        return transaction;
      } catch (err) {
        console.error(err);
        setWithdrawSoEurcStatus(Status.ERROR);
        setError(err instanceof Error ? err.message : 'Unknown error');
        Sentry.captureException(err, {
          tags: { type: 'withdraw_soeurc_error' },
          extra: { amount, userAddress: user?.safeAddress },
        });
        throw err;
      }
    },
    [user, safeAA, trackTransaction],
  );

  return { withdrawSoEurc, withdrawSoEurcStatus, error };
};

export default useWithdrawSoEurc;
