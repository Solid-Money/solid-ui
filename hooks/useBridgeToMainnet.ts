import { TRACKING_EVENTS } from '@/constants/tracking-events';
import BridgePayamster_ABI from '@/lib/abis/BridgePayamster';
import ERC20_ABI from '@/lib/abis/ERC20';
import ETHEREUM_TELLER_ABI from '@/lib/abis/EthereumTeller';
import { track } from '@/lib/analytics';
import { ADDRESSES } from '@/lib/config';
import { executeTransactions, USER_CANCELLED_TRANSACTION } from '@/lib/execute';
import { Status } from '@/lib/types';
import * as Sentry from '@sentry/react-native';
import { Address } from 'abitype';
import { useCallback, useState } from 'react';
import { TransactionReceipt } from 'viem';
import { fuse } from 'viem/chains';
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

const useBridgeToMainnet = (): BridgeResult => {
  const { user, safeAA } = useUser();
  const [bridgeStatus, setBridgeStatus] = useState<Status>(Status.IDLE);
  const [error, setError] = useState<string | null>(null);

  const { data: fee } = useReadContract({
    abi: ETHEREUM_TELLER_ABI,
    address: ADDRESSES.fuse.teller,
    functionName: 'previewFee',
    args: [
      BigInt(0),
      user?.safeAddress as Address,
      encodeAbiParameters(parseAbiParameters('uint32'), [30101]),
      ADDRESSES.fuse.nativeFeeToken,
    ],
    chainId: fuse.id,
  });

  const bridge = useCallback(async (amount: string) => {
    try {
      if (!user) {
        const error = new Error('User is not selected');
        track(TRACKING_EVENTS.BRIDGE_TO_MAINNET_ERROR, {
          amount: amount,
          error: 'User not found',
          step: 'validation',
          source: 'useBridgeToMainnet',
        });
        Sentry.captureException(error, {
          tags: {
            operation: 'bridge_to_mainnet',
            step: 'validation',
          },
          extra: {
            amount,
            hasUser: !!user,
          },
        });
        throw error;
      }

      track(TRACKING_EVENTS.BRIDGE_TO_MAINNET_INITIATED, {
        amount: amount,
        fee: fee?.toString() || '0',
        from_chain: fuse.id,
        to_chain: 1, // mainnet
        source: 'useBridgeToMainnet',
      });

      setBridgeStatus(Status.PENDING);
      setError(null);

      const amountWei = parseUnits(amount, 6);

      Sentry.addBreadcrumb({
        message: 'Starting bridge to Mainnet transaction',
        category: 'bridge',
        data: {
          amount,
          amountWei: amountWei.toString(),
          userAddress: user.safeAddress,
          chainId: fuse.id,
        },
      });

      const callData = encodeFunctionData({
        abi: ETHEREUM_TELLER_ABI,
        functionName: 'bridge',
        args: [
          amountWei,
          user.safeAddress,
          encodeAbiParameters(parseAbiParameters('uint32'), [30101]),
          ADDRESSES.fuse.nativeFeeToken,
          fee ? fee : 0n,
        ],
      });

      const transactions = [
        {
          to: ADDRESSES.fuse.vault,
          data: encodeFunctionData({
            abi: ERC20_ABI,
            functionName: 'transfer',
            args: [ADDRESSES.fuse.bridgePaymasterAddress, amountWei],
          }),
          value: 0n,
        },
        {
          to: ADDRESSES.fuse.bridgePaymasterAddress,
          data: encodeFunctionData({
            abi: BridgePayamster_ABI,
            functionName: 'callWithValue',
            args: [ADDRESSES.fuse.teller, '0x05921740', callData, fee ? fee : 0n],
          }),
          value: 0n,
        },
      ];

      const smartAccountClient = await safeAA(fuse, user.suborgId, user.signWith);

      const transaction = await executeTransactions(
        smartAccountClient,
        transactions,
        'Unstake failed',
        fuse,
      );

      if (transaction === USER_CANCELLED_TRANSACTION) {
        const error = new Error('User cancelled transaction');
        track(TRACKING_EVENTS.BRIDGE_TO_MAINNET_CANCELLED, {
          amount: amount,
          fee: fee?.toString() || '0',
          from_chain: fuse.id,
          to_chain: 1,
          source: 'useBridgeToMainnet',
        });
        Sentry.captureException(error, {
          tags: {
            operation: 'bridge_to_mainnet',
            step: 'execution',
            reason: 'user_cancelled',
          },
          extra: {
            amount,
            userAddress: user.safeAddress,
            chainId: fuse.id,
            fee: fee?.toString(),
          },
          user: {
            id: user?.userId,
            address: user?.safeAddress,
          },
        });
        throw error;
      }

      track(TRACKING_EVENTS.BRIDGE_TO_MAINNET_COMPLETED, {
        amount: amount,
        transaction_hash: transaction.transactionHash,
        fee: fee?.toString() || '0',
        from_chain: fuse.id,
        to_chain: 1,
        source: 'useBridgeToMainnet',
      });

      Sentry.addBreadcrumb({
        message: 'Bridge to Mainnet transaction successful',
        category: 'bridge',
        data: {
          amount,
          transactionHash: transaction.transactionHash,
          userAddress: user.safeAddress,
          chainId: fuse.id,
        },
      });

      setBridgeStatus(Status.SUCCESS);
      return transaction;
    } catch (error) {
      console.error(error);

      track(TRACKING_EVENTS.BRIDGE_TO_MAINNET_ERROR, {
        amount: amount,
        fee: fee?.toString() || '0',
        from_chain: fuse.id,
        to_chain: 1,
        error: error instanceof Error ? error.message : 'Unknown error',
        user_cancelled: String(error).includes('cancelled'),
        step: 'execution',
        source: 'useBridgeToMainnet',
      });

      Sentry.captureException(error, {
        tags: {
          operation: 'bridge_to_mainnet',
          step: 'execution',
        },
        extra: {
          amount,
          userAddress: user?.safeAddress,
          chainId: fuse.id,
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
  }, [user, fee, safeAA]);

  return { bridge, bridgeStatus, error };
};

export default useBridgeToMainnet;
