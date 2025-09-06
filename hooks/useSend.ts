import { Address } from 'abitype';
import { useState } from 'react';
import { TransactionReceipt } from 'viem';
import { encodeFunctionData, parseUnits } from 'viem/utils';
import * as Sentry from '@sentry/react-native';

import ERC20_ABI from '@/lib/abis/ERC20';
import { executeTransactions, USER_CANCELLED_TRANSACTION } from '@/lib/execute';
import { Status } from '@/lib/types';
import { getChain } from '@/lib/wagmi';
import useUser from './useUser';

type SendProps = {
  tokenAddress: Address;
  tokenDecimals: number;
  chainId: number;
};

type SendResult = {
  send: (amount: string, to: Address) => Promise<TransactionReceipt>;
  sendStatus: Status;
  error: string | null;
  resetSendStatus: () => void;
};

const useSend = ({ tokenAddress, tokenDecimals, chainId }: SendProps): SendResult => {
  const { user, safeAA } = useUser();
  const [sendStatus, setSendStatus] = useState<Status>(Status.IDLE);
  const [error, setError] = useState<string | null>(null);
  const chain = getChain(chainId);

  const send = async (amount: string, to: Address) => {
    try {
      if (!user) {
        throw new Error('User not found');
      }

      if (!chain) {
        throw new Error('Chain not found');
      }

      setSendStatus(Status.PENDING);
      setError(null);

      const amountWei = parseUnits(amount, tokenDecimals);

      const transactions = [
        {
          to: tokenAddress,
          data: encodeFunctionData({
            abi: ERC20_ABI,
            functionName: 'transfer',
            args: [to, amountWei],
          }),
          value: 0n,
        },
      ];

      const smartAccountClient = await safeAA(chain, user.suborgId, user.signWith);

      const transaction = await executeTransactions(
        smartAccountClient,
        transactions,
        'Send failed',
        chain,
      );

      if (transaction === USER_CANCELLED_TRANSACTION) {
        throw new Error('User cancelled transaction');
      }

      setSendStatus(Status.SUCCESS);
      return transaction;
    } catch (error) {
      console.error(error);
      Sentry.captureException(error, {
        tags: {
          type: 'send_transaction_error',
          chainId: chainId.toString(),
          userId: user?.id,
        },
        extra: {
          tokenAddress,
          amount,
          to,
          tokenDecimals,
        },
      });
      setSendStatus(Status.ERROR);
      setError(error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  };

  const resetSendStatus = () => {
    setSendStatus(Status.IDLE);
    setError(null);
  };

  return { send, sendStatus, error, resetSendStatus };
};

export default useSend;
