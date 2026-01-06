import { useActivity } from '@/hooks/useActivity';
import BridgePayamster_ABI from '@/lib/abis/BridgePayamster';
import ETHEREUM_TELLER_ABI from '@/lib/abis/EthereumTeller';
import { ADDRESSES } from '@/lib/config';
import { executeTransactions, USER_CANCELLED_TRANSACTION } from '@/lib/execute';
import { Status, TransactionType } from '@/lib/types';
import * as Sentry from '@sentry/react-native';
import { Address } from 'abitype';
import { useState } from 'react';
import { erc20Abi, TransactionReceipt } from 'viem';
import { mainnet } from 'viem/chains';
import {
  encodeAbiParameters,
  encodeFunctionData,
  parseAbiParameters,
  parseUnits,
} from 'viem/utils';
import { useReadContract } from 'wagmi';
import useUser from './useUser';

type BridgeResult = {
  bridge: (amount: string) => Promise<TransactionReceipt>;
  bridgeStatus: Status;
  error: string | null;
};

const useBridgeToFuse = (): BridgeResult => {
  const { user, safeAA } = useUser();
  const { trackTransaction } = useActivity();
  const [bridgeStatus, setBridgeStatus] = useState<Status>(Status.IDLE);
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

  const bridge = async (amount: string) => {
    try {
      if (!user) {
        const error = new Error('User is not selected');
        Sentry.captureException(error, {
          tags: {
            operation: 'bridge_to_fuse',
            step: 'validation',
          },
          extra: {
            amount,
            hasUser: !!user,
          },
        });
        throw error;
      }

      setBridgeStatus(Status.PENDING);
      setError(null);

      const amountWei = parseUnits(amount, 6);

      Sentry.addBreadcrumb({
        message: 'Starting bridge to Fuse transaction',
        category: 'bridge',
        data: {
          amount,
          amountWei: amountWei.toString(),
          userAddress: user.safeAddress,
          chainId: mainnet.id,
        },
      });

      const callData = encodeFunctionData({
        abi: ETHEREUM_TELLER_ABI,
        functionName: 'bridge',
        args: [
          amountWei,
          user.safeAddress,
          encodeAbiParameters(parseAbiParameters('uint32'), [30138]),
          ADDRESSES.ethereum.nativeFeeToken,
          fee ? fee : 0n,
        ],
      });

      const transactions = [
        {
          to: ADDRESSES.ethereum.vault,
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
            args: [ADDRESSES.ethereum.teller, '0x05921740', callData, fee ? fee : 0n],
          }),
          value: 0n,
        },
      ];

      const smartAccountClient = await safeAA(mainnet, user.suborgId, user.signWith);

      const result = await trackTransaction(
        {
          type: TransactionType.BRIDGE_DEPOSIT,
          title: `Stake ${amount} soUSD to Fuse`,
          shortTitle: `Stake ${amount}`,
          amount,
          symbol: 'soUSD',
          chainId: mainnet.id,
          fromAddress: user.safeAddress,
          toAddress: user.safeAddress,
          metadata: {
            description: `Stake ${amount} soUSD from Mainnet to Fuse`,
            fee: fee?.toString(),
          },
        },
        onUserOpHash =>
          executeTransactions(
            smartAccountClient,
            transactions,
            'Bridge failed',
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
        Sentry.captureException(error, {
          tags: {
            operation: 'bridge_to_fuse',
            step: 'execution',
            reason: 'user_cancelled',
          },
          extra: {
            amount,
            userAddress: user.safeAddress,
            chainId: mainnet.id,
            fee: fee?.toString(),
          },
        });
        throw error;
      }

      Sentry.addBreadcrumb({
        message: 'Bridge to Fuse transaction successful',
        category: 'bridge',
        data: {
          amount,
          transactionHash: transaction.transactionHash,
          userAddress: user.safeAddress,
          chainId: mainnet.id,
        },
      });

      setBridgeStatus(Status.SUCCESS);
      return transaction;
    } catch (error) {
      console.error(error);

      Sentry.captureException(error, {
        tags: {
          operation: 'bridge_to_fuse',
          step: 'execution',
        },
        extra: {
          amount,
          userAddress: user?.safeAddress,
          chainId: mainnet.id,
          fee: fee?.toString(),
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
          bridgeStatus,
        },
        user: {
          id: user?.suborgId,
          address: user?.safeAddress,
        },
      });

      setBridgeStatus(Status.ERROR);
      setError(error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  };

  return { bridge, bridgeStatus, error };
};

export default useBridgeToFuse;
