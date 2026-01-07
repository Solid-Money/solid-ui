import * as Sentry from '@sentry/react-native';
import { useState } from 'react';
import {
  type Address,
  encodeAbiParameters,
  encodeFunctionData,
  erc20Abi,
  parseAbiParameters,
  parseUnits,
  TransactionReceipt,
} from 'viem';
import { mainnet } from 'viem/chains';
import { useReadContract } from 'wagmi';

import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { useActivity } from '@/hooks/useActivity';
import BridgePayamster_ABI from '@/lib/abis/BridgePayamster';
import ETHEREUM_TELLER_ABI from '@/lib/abis/EthereumTeller';
import { track, trackIdentity } from '@/lib/analytics';
import { getAttributionChannel } from '@/lib/attribution';
import { ADDRESSES } from '@/lib/config';
import { executeTransactions, USER_CANCELLED_TRANSACTION } from '@/lib/execute';
import { Status, TransactionType } from '@/lib/types';
import { useAttributionStore } from '@/store/useAttributionStore';
import useUser from './useUser';

type DepositResult = {
  deposit: (amount: string) => Promise<TransactionReceipt>;
  depositStatus: Status;
  error: string | null;
};

const useDeposit = (): DepositResult => {
  const { user, safeAA } = useUser();
  const { trackTransaction } = useActivity();
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
    // Capture attribution context for conversion tracking
    const attributionData = useAttributionStore.getState().getAttributionForEvent();
    const attributionChannel = getAttributionChannel(attributionData);

    try {
      if (!user) {
        const error = new Error('User is not selected');
        track(TRACKING_EVENTS.DEPOSIT_ERROR, {
          amount: amount,
          error: 'User not found',
          step: 'validation',
          source: 'useDeposit_hook',
          ...attributionData,
          attribution_channel: attributionChannel,
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
        });
        throw error;
      }

      track(TRACKING_EVENTS.DEPOSIT_INITIATED, {
        user_id: user.userId,
        safe_address: user.safeAddress,
        amount: amount,
        fee: fee?.toString() || '0',
        chain_id: mainnet.id,
        deposit_type: 'safe_account',
        deposit_method: 'ethereum_safe_to_bridge',
        source: 'useDeposit_hook',
        ...attributionData,
        attribution_channel: attributionChannel,
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
            abi: erc20Abi,
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

      const result = await trackTransaction(
        {
          type: TransactionType.DEPOSIT,
          title: `Deposit ${amount} USDC`,
          shortTitle: `Deposit ${amount}`,
          amount,
          symbol: 'USDC',
          chainId: mainnet.id,
          fromAddress: user.safeAddress,
          toAddress: user.safeAddress,
          metadata: {
            description: `Deposit ${amount} USDC from Safe to Fuse`,
            fee: fee?.toString(),
          },
        },
        onUserOpHash =>
          executeTransactions(
            smartAccountClient,
            transactions,
            'Deposit failed',
            mainnet,
            onUserOpHash,
          ),
      );

      const transaction =
        result && typeof result === 'object' && 'transaction' in result
          ? result.transaction
          : result;

      if (transaction === USER_CANCELLED_TRANSACTION) {
        const error = new Error('User cancelled transaction');
        track(TRACKING_EVENTS.DEPOSIT_CANCELLED, {
          user_id: user.userId,
          safe_address: user.safeAddress,
          amount: amount,
          fee: fee?.toString() || '0',
          deposit_type: 'safe_account',
          source: 'useDeposit_hook',
          ...attributionData,
          attribution_channel: attributionChannel,
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
        user_id: user.userId,
        safe_address: user.safeAddress,
        amount: amount,
        transaction_hash: transaction.transactionHash,
        fee: fee?.toString() || '0',
        chain_id: mainnet.id,
        deposit_type: 'safe_account',
        deposit_method: 'ethereum_safe_to_bridge',
        is_first_deposit: !user.isDeposited,
        source: 'useDeposit_hook',
        ...attributionData,
        attribution_channel: attributionChannel,
      });

      trackIdentity(user.userId, {
        last_deposit_amount: parseFloat(amount),
        last_deposit_date: new Date().toISOString(),
        last_deposit_method: 'ethereum_safe_to_bridge',
        last_deposit_chain: 'ethereum',
        ...attributionData,
        attribution_channel: attributionChannel,
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
        user_id: user?.userId,
        safe_address: user?.safeAddress,
        amount: amount,
        fee: fee?.toString() || '0',
        error: error instanceof Error ? error.message : 'Unknown error',
        step: 'execution',
        user_cancelled: String(error).includes('cancelled'),
        deposit_type: 'safe_account',
        source: 'useDeposit_hook',
        ...attributionData,
        attribution_channel: attributionChannel,
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
