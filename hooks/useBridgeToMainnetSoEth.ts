import { useCallback, useState } from 'react';
import * as Sentry from '@sentry/react-native';
import { Address } from 'abitype';
import { erc20Abi, TransactionReceipt } from 'viem';
import { fuse } from 'viem/chains';
import {
  encodeAbiParameters,
  encodeFunctionData,
  parseAbiParameters,
  parseUnits,
} from 'viem/utils';
import { useReadContract } from 'wagmi';

import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { useActivityActions } from '@/hooks/useActivityActions';
import BridgePayamster_ABI from '@/lib/abis/BridgePayamster';
import ETHEREUM_TELLER_ABI from '@/lib/abis/EthereumTeller';
import { track } from '@/lib/analytics';
import { ADDRESSES } from '@/lib/config';
import { executeTransactions, USER_CANCELLED_TRANSACTION } from '@/lib/execute';
import { Status, TransactionStatus, TransactionType } from '@/lib/types';
import { waitForLayerzeroTransaction } from '@/lib/utils/layerzero';

import useUser from './useUser';

type BridgeSoEthResult = {
  bridgeSoEth: (amount: string) => Promise<TransactionReceipt>;
  bridgeSoEthStatus: Status;
  error: string | null;
};

const useBridgeToMainnetSoEth = (): BridgeSoEthResult => {
  const { user, safeAA } = useUser();
  const { trackTransaction, updateActivity } = useActivityActions();
  const [bridgeSoEthStatus, setBridgeSoEthStatus] = useState<Status>(Status.IDLE);
  const [error, setError] = useState<string | null>(null);

  const { data: fee } = useReadContract({
    abi: ETHEREUM_TELLER_ABI,
    address: ADDRESSES.fuse.soEthTeller,
    functionName: 'previewFee',
    args: [
      BigInt(0),
      user?.safeAddress as Address,
      encodeAbiParameters(parseAbiParameters('uint32'), [30101]),
      ADDRESSES.fuse.nativeFeeToken,
    ],
    chainId: fuse.id,
  });

  const bridgeSoEth = useCallback(
    async (amount: string) => {
      try {
        if (!user) {
          const error = new Error('User is not selected');
          track(TRACKING_EVENTS.BRIDGE_TO_MAINNET_ERROR, {
            amount: amount,
            error: 'User not found',
            step: 'validation',
            source: 'useBridgeToMainnetSoEth',
          });
          Sentry.captureException(error, {
            tags: {
              operation: 'bridge_soeth_to_mainnet',
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
          to_chain: 1,
          source: 'useBridgeToMainnetSoEth',
        });

        setBridgeSoEthStatus(Status.PENDING);
        setError(null);

        const amountWei = parseUnits(amount, 18);

        Sentry.addBreadcrumb({
          message: 'Starting soETH bridge to Mainnet transaction',
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
            to: ADDRESSES.fuse.soEthVault,
            data: encodeFunctionData({
              abi: erc20Abi,
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
              args: [ADDRESSES.fuse.soEthTeller, '0x05921740', callData, fee ? fee : 0n],
            }),
            value: 0n,
          },
        ];

        const smartAccountClient = await safeAA(fuse, user.suborgId, user.signWith);

        let bridgeClientTxId: string | null = null;
        const result = await trackTransaction(
          {
            type: TransactionType.BRIDGE_DEPOSIT,
            title: `Withdraw ${amount} soETH`,
            shortTitle: `Withdraw ${amount}`,
            amount,
            symbol: 'soETH',
            chainId: fuse.id,
            fromAddress: user.safeAddress,
            toAddress: user.safeAddress,
            metadata: {
              description: `Withdraw ${amount} soETH from Fuse to Mainnet`,
              fee: fee?.toString(),
              tokenAddress: ADDRESSES.fuse.soEthVault,
            },
          },
          onUserOpHash => {
            bridgeClientTxId = onUserOpHash;
            return executeTransactions(
              smartAccountClient,
              transactions,
              'Withdraw soETH failed',
              fuse,
              onUserOpHash,
            );
          },
        );

        const transaction =
          result && typeof result === 'object' && 'transaction' in result
            ? result.transaction
            : result;

        if (transaction === USER_CANCELLED_TRANSACTION) {
          const error = new Error('User cancelled transaction');
          track(TRACKING_EVENTS.BRIDGE_TO_MAINNET_CANCELLED, {
            amount: amount,
            fee: fee?.toString() || '0',
            from_chain: fuse.id,
            to_chain: 1,
            source: 'useBridgeToMainnetSoEth',
          });
          Sentry.captureException(error, {
            tags: {
              operation: 'bridge_soeth_to_mainnet',
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
          source: 'useBridgeToMainnetSoEth',
        });

        Sentry.addBreadcrumb({
          message: 'soETH bridge to Mainnet transaction successful',
          category: 'bridge',
          data: {
            amount,
            transactionHash: transaction.transactionHash,
            userAddress: user.safeAddress,
            chainId: fuse.id,
          },
        });
        const layerzeroTransaction = await waitForLayerzeroTransaction(transaction.transactionHash);
        if (layerzeroTransaction.data[0].status.name === 'DELIVERED') {
          setBridgeSoEthStatus(Status.SUCCESS);

          if (bridgeClientTxId) {
            updateActivity(bridgeClientTxId, {
              status: TransactionStatus.SUCCESS,
              metadata: {
                layerzeroDeliveredAt: new Date().toISOString(),
              },
            });
          }

          return transaction;
        } else {
          throw new Error('Layerzero transaction failed');
        }
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
          source: 'useBridgeToMainnetSoEth',
        });

        Sentry.captureException(error, {
          tags: {
            operation: 'bridge_soeth_to_mainnet',
            step: 'execution',
          },
          extra: {
            amount,
            userAddress: user?.safeAddress,
            chainId: fuse.id,
            fee: fee?.toString(),
            errorMessage: error instanceof Error ? error.message : 'Unknown error',
            bridgeSoEthStatus,
          },
          user: {
            id: user?.suborgId,
            address: user?.safeAddress,
          },
        });

        setBridgeSoEthStatus(Status.ERROR);
        setError(error instanceof Error ? error.message : 'Unknown error');
        throw error;
      }
    },
    [user, fee, safeAA, trackTransaction, updateActivity],
  );

  return { bridgeSoEth, bridgeSoEthStatus, error };
};

export default useBridgeToMainnetSoEth;
