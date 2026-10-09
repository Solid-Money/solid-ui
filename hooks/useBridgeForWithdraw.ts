import { useCallback, useMemo, useState } from 'react';
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
import {
  SOUSD_WITHDRAW_CHAIN_ID,
  SOUSD_WITHDRAW_CHAINS,
  SoUsdWithdrawChainId,
} from '@/lib/soUsdWithdraw';
import { Status, TransactionStatus, TransactionType } from '@/lib/types';
import { waitForLayerzeroTransaction } from '@/lib/utils/layerzero';
import { useWithdrawSessionStore } from '@/store/useWithdrawSessionStore';

import useUser from './useUser';

type BridgeResult = {
  bridge: (amount: string) => Promise<TransactionReceipt>;
  bridgeStatus: Status;
  error: string | null;
};

/**
 * Step 1 of a soUSD withdrawal: bridge the shares from Fuse to the chain they
 * are withdrawn on (Base, or Ethereum before the move), where step 2 queues them
 * for USDC.
 */
const useBridgeForWithdraw = (
  toChainId: SoUsdWithdrawChainId = SOUSD_WITHDRAW_CHAIN_ID,
): BridgeResult => {
  const { user, safeAA } = useUser();
  const destination = SOUSD_WITHDRAW_CHAINS[toChainId];
  const bridgeWildCard = useMemo(
    () => encodeAbiParameters(parseAbiParameters('uint32'), [destination.lzEid]),
    [destination.lzEid],
  );
  const { trackTransaction, updateActivity } = useActivityActions();
  const [bridgeStatus, setBridgeStatus] = useState<Status>(Status.IDLE);
  const [error, setError] = useState<string | null>(null);

  const { data: fee } = useReadContract({
    abi: ETHEREUM_TELLER_ABI,
    address: ADDRESSES.fuse.teller,
    functionName: 'previewFee',
    args: [
      BigInt(0),
      user?.safeAddress as Address,
      bridgeWildCard,
      ADDRESSES.fuse.nativeFeeToken,
    ],
    chainId: fuse.id,
  });

  const bridge = useCallback(
    async (amount: string) => {
      try {
        if (!user) {
          const error = new Error('User is not selected');
          track(TRACKING_EVENTS.BRIDGE_TO_MAINNET_ERROR, {
            amount: amount,
            error: 'User not found',
            step: 'validation',
            source: 'useBridgeForWithdraw',
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
          to_chain: toChainId,
          source: 'useBridgeForWithdraw',
        });

        setBridgeStatus(Status.PENDING);
        setError(null);

        const amountWei = parseUnits(amount, 6);

        Sentry.addBreadcrumb({
          message: `Starting bridge to ${destination.name} transaction`,
          category: 'bridge',
          data: {
            amount,
            amountWei: amountWei.toString(),
            userAddress: user.safeAddress,
            chainId: fuse.id,
          },
        });

        const transactions = [
          // The paymaster pulls the shares itself, so it can only ever bridge what this
          // Safe approved - it no longer custodies shares between calls.
          {
            to: ADDRESSES.fuse.vault,
            data: encodeFunctionData({
              abi: erc20Abi,
              functionName: 'approve',
              args: [ADDRESSES.fuse.bridgePaymasterAddress, amountWei],
            }),
            value: 0n,
          },
          {
            to: ADDRESSES.fuse.bridgePaymasterAddress,
            data: encodeFunctionData({
              abi: BridgePayamster_ABI,
              functionName: 'sponsorBridge',
              args: [
                ADDRESSES.fuse.teller,
                amountWei,
                user.safeAddress as Address,
                bridgeWildCard,
              ],
            }),
            value: 0n,
          },
        ];

        const smartAccountClient = await safeAA(fuse, user.suborgId, user.signWith);

        let bridgeClientTxId: string | null = null;
        const result = await trackTransaction(
          {
            type: TransactionType.BRIDGE_DEPOSIT,
            title: `Withdraw ${amount} soUSD`,
            shortTitle: `Withdraw ${amount}`,
            amount,
            symbol: 'USDC',
            chainId: fuse.id,
            fromAddress: user.safeAddress,
            toAddress: user.safeAddress,
            metadata: {
              description: `Withdraw ${amount} soUSD from Fuse to ${destination.name}`,
              fee: fee?.toString(),
              tokenAddress: ADDRESSES.fuse.vault,
            },
          },
          onUserOpHash => {
            bridgeClientTxId = onUserOpHash;
            return executeTransactions(
              smartAccountClient,
              transactions,
              'Withdraw failed',
              fuse,
              hash => {
                // Persist a resume session the moment the bridge tx is broadcast
                // (after simulation passes). This way, if the user closes the flow
                // before the destination-side withdraw, it can be resumed on step 2.
                if (user?.safeAddress) {
                  useWithdrawSessionStore.getState().setSession({
                    address: user.safeAddress,
                    vault: 'USD',
                    amount,
                    destinationSymbol: 'USDC',
                    chainId: toChainId,
                    createdAt: Date.now(),
                  });
                }
                onUserOpHash(hash);
              },
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
            to_chain: toChainId,
            source: 'useBridgeForWithdraw',
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
          to_chain: toChainId,
          source: 'useBridgeForWithdraw',
        });

        Sentry.addBreadcrumb({
          message: `Bridge to ${destination.name} transaction successful`,
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
          setBridgeStatus(Status.SUCCESS);

          // Update the backend activity status to SUCCESS after LayerZero delivery.
          // Without this, the transaction monitor keeps bridge_deposit at PROCESSING
          // (sourceChainConfirmed) indefinitely since no external mechanism finalizes it.
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
          to_chain: toChainId,
          error: error instanceof Error ? error.message : 'Unknown error',
          user_cancelled: String(error).includes('cancelled'),
          step: 'execution',
          source: 'useBridgeForWithdraw',
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
    },
    [user, fee, safeAA, trackTransaction, updateActivity, toChainId, destination, bridgeWildCard],
  );

  return { bridge, bridgeStatus, error };
};

export default useBridgeForWithdraw;
