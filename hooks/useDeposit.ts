import * as Sentry from '@sentry/react-native';
import { useState } from 'react';
import {
    type Address,
    encodeAbiParameters,
    encodeFunctionData,
    parseAbiParameters,
    parseUnits,
    TransactionReceipt,
} from 'viem';
import { mainnet } from 'viem/chains';
import { useReadContract } from 'wagmi';

import { TRACKING_EVENTS } from '@/constants/tracking-events';
import BridgePayamster_ABI from '@/lib/abis/BridgePayamster';
import ERC20_ABI from '@/lib/abis/ERC20';
import ETHEREUM_TELLER_ABI from '@/lib/abis/EthereumTeller';
import { track } from '@/lib/analytics';
import { ADDRESSES } from '@/lib/config';
import { executeTransactions, USER_CANCELLED_TRANSACTION } from '@/lib/execute';
import { Status } from '@/lib/types';
import useUser from './useUser';

type DepositResult = {
  deposit: (amount: string) => Promise<TransactionReceipt>;
  depositStatus: Status;
  error: string | null;
};

const useDeposit = (): DepositResult => {
  const { user, safeAA } = useUser();
  const [depositStatus, setDepositStatus] = useState<Status>(Status.IDLE);
  const [error, setError] = useState<string | null>(null);

  const { data: fee } = useReadContract({
    abi: ETHEREUM_TELLER_ABI,
    address: ADDRESSES.ethereum.teller,
    functionName: 'previewFee',
    args: [
      BigInt(0),
      user?.safeAddress as Address,
      encodeAbiParameters(parseAbiParameters('uint32'), [30138]),
      ADDRESSES.ethereum.nativeFeeToken,
    ],
    chainId: mainnet.id,
  });

  const deposit = async (amount: string) => {
    try {
      if (!user) {
        const error = new Error('User is not selected');
        track(TRACKING_EVENTS.DEPOSIT_ERROR, {
          amount: amount,
          error: 'User not found',
          step: 'validation',
          source: 'useDeposit_hook',
        });
        Sentry.captureException(error, {
          tags: {
            operation: 'deposit_from_safe',
            step: 'validation',
          },
          extra: {
            amount,
            hasUser: !!user,
          },
          user: {
            id: user?.userId,
            address: user?.safeAddress,
          },
        });
        throw error;
      }

      track(TRACKING_EVENTS.DEPOSIT_INITIATED, {
        amount: amount,
        fee: fee?.toString() || '0',
        chain_id: mainnet.id,
        source: 'useDeposit_hook',
      });

      setDepositStatus(Status.PENDING);
      setError(null);

      const amountWei = parseUnits(amount, 6);

      Sentry.addBreadcrumb({
        message: 'Starting deposit from Safe transaction',
        category: 'deposit',
        data: {
          amount,
          amountWei: amountWei.toString(),
          userAddress: user.safeAddress,
          chainId: mainnet.id,
        },
      });

      const callData = encodeFunctionData({
        abi: ETHEREUM_TELLER_ABI,
        functionName: 'depositAndBridge',
        args: [
          ADDRESSES.ethereum.usdc,
          amountWei,
          0n,
          user.safeAddress,
          encodeAbiParameters(parseAbiParameters('uint32'), [30138]), // bridgeWildCard
          ADDRESSES.ethereum.nativeFeeToken,
          fee ? fee : 0n,
        ],
      });

      const transactions = [
        {
          to: ADDRESSES.ethereum.usdc,
          data: encodeFunctionData({
            abi: ERC20_ABI,
            functionName: 'transfer',
            args: [ADDRESSES.ethereum.bridgePaymasterAddress, amountWei],
          }),
          value: 0n,
        },
        {
          to: ADDRESSES.ethereum.bridgePaymasterAddress,
          data: encodeFunctionData({
            abi: BridgePayamster_ABI,
            functionName: 'callWithValue',
            args: [ADDRESSES.ethereum.teller, '0xcab716e8', callData, fee ? fee : 0n],
          }),
          value: 0n,
        },
      ];

      const smartAccountClient = await safeAA(mainnet, user.suborgId, user.signWith);

      const transaction = await executeTransactions(
        smartAccountClient,
        transactions,
        'Deposit failed',
        mainnet,
      );

      if (transaction === USER_CANCELLED_TRANSACTION) {
        const error = new Error('User cancelled transaction');
        track(TRACKING_EVENTS.DEPOSIT_CANCELLED, {
          amount: amount,
          fee: fee?.toString() || '0',
          source: 'useDeposit_hook',
        });
        Sentry.captureException(error, {
          tags: {
            operation: 'deposit_from_safe',
            step: 'execution',
            reason: 'user_cancelled',
          },
          extra: {
            amount,
            userAddress: user.safeAddress,
            chainId: mainnet.id,
            fee: fee?.toString(),
          },
          user: {
            id: user?.userId,
            address: user?.safeAddress,
          },
        });
        throw error;
      }

      track(TRACKING_EVENTS.DEPOSIT_COMPLETED, {
        amount: amount,
        transaction_hash: transaction.transactionHash,
        fee: fee?.toString() || '0',
        chain_id: mainnet.id,
        source: 'useDeposit_hook',
      });

      Sentry.addBreadcrumb({
        message: 'Deposit from Safe transaction successful',
        category: 'deposit_from_safe',
        data: {
          amount,
          transactionHash: transaction.transactionHash,
          userAddress: user.safeAddress,
          chainId: mainnet.id,
        },
      });

      setDepositStatus(Status.SUCCESS);
      return transaction;
    } catch (error) {
      console.error(error);

      track(TRACKING_EVENTS.DEPOSIT_ERROR, {
        amount: amount,
        fee: fee?.toString() || '0',
        error: error instanceof Error ? error.message : 'Unknown error',
        step: 'execution',
        user_cancelled: String(error).includes('cancelled'),
        source: 'useDeposit_hook',
      });

      Sentry.captureException(error, {
        tags: {
          operation: 'deposit_from_safe',
          step: 'execution',
        },
        extra: {
          amount,
          userAddress: user?.safeAddress,
          chainId: mainnet.id,
          fee: fee?.toString(),
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
          depositStatus,
        },
        user: {
          id: user?.suborgId,
          address: user?.safeAddress,
        },
      });

      setDepositStatus(Status.ERROR);
      setError(error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  };

  return { deposit, depositStatus, error };
};

export default useDeposit;
