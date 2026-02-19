import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { useActivityActions } from '@/hooks/useActivityActions';
import { FastWithdrawManager_ABI } from '@/lib/abis/FastWithdrawManager';
import { track } from '@/lib/analytics';
import { ADDRESSES } from '@/lib/config';
import { executeTransactions, USER_CANCELLED_TRANSACTION } from '@/lib/execute';
import { Status, TransactionType } from '@/lib/types';
import * as Sentry from '@sentry/react-native';
import { Address } from 'abitype';
import { useCallback, useState } from 'react';
import { erc20Abi, TransactionReceipt } from 'viem';
import { fuse } from 'viem/chains';
import { encodeFunctionData, parseUnits } from 'viem/utils';
import useUser from './useUser';

type FastWithdrawResult = {
  fastWithdraw: (amount: string, toAddress: Address) => Promise<TransactionReceipt>;
  fastWithdrawStatus: Status;
  error: string | null;
};

const useFastWithdraw = (): FastWithdrawResult => {
  const { user, safeAA } = useUser();
  const { trackTransaction } = useActivityActions();
  const [fastWithdrawStatus, setFastWithdrawStatus] = useState<Status>(Status.IDLE);
  const [error, setError] = useState<string | null>(null);

  const fastWithdraw = useCallback(
    async (amount: string, toAddress: Address) => {
      try {
        if (!user) {
          const error = new Error('User is not selected');
          track(TRACKING_EVENTS.FAST_WITHDRAW_FAILED, {
            amount: amount,
            toAddress: toAddress,
            error: 'User not found',
            step: 'validation',
            source: 'useFastWithdraw',
          });
          Sentry.captureException(error, {
            tags: {
              operation: 'fast_withdraw',
              step: 'validation',
            },
            extra: {
              amount,
              hasUser: !!user,
              toAddress: toAddress,
            },
          });
          throw error;
        }

        if (!toAddress) {
          const error = new Error('To address not found');
          track(TRACKING_EVENTS.FAST_WITHDRAW_FAILED, {
            amount: amount,
            toAddress: toAddress,
            error: 'To address not found',
            step: 'validation',
            source: 'useFastWithdraw',
          });
          Sentry.captureException(error, {
            tags: {
              operation: 'fast_withdraw',
              step: 'validation',
            },
            extra: {
              amount,
              toAddress: toAddress,
              hasToAddress: !!toAddress,
            },
          });
          throw error;
        }

        track(TRACKING_EVENTS.FAST_WITHDRAW_INITIATED, {
          amount: amount,
          from_chain: fuse.id,
          source: 'useFastWithdraw',
        });

        setFastWithdrawStatus(Status.PENDING);
        setError(null);

        const destinationAddress = toAddress;
        const amountWei = parseUnits(amount, 6);

        Sentry.addBreadcrumb({
          message: 'Starting fast withdraw and bridge transaction',
          category: 'bridge',
          data: {
            amount,
            amountWei: amountWei.toString(),
            userAddress: user.safeAddress,
            toAddress: toAddress,
          },
        });

        const transactions = [
          // 1) Approve soUSD from Safe to WithdrawManager
          {
            to: ADDRESSES.fuse.vault,
            data: encodeFunctionData({
              abi: erc20Abi,
              functionName: 'approve',
              args: [ADDRESSES.fuse.fastWithdrawManager, amountWei],
            }),
            value: 0n,
          },
          // 2) Perform the Stargate taxi call via BridgePaymaster and WithdrawManager, forwarding the fee it now holds
          {
            to: ADDRESSES.fuse.fastWithdrawManager,
            data: encodeFunctionData({
              abi: FastWithdrawManager_ABI,
              functionName: 'swapAndWithdraw',
              args: [
                ADDRESSES.fuse.stargateOftUSDC as Address,
                user.safeAddress as Address,
                amountWei,
                toAddress,
              ],
            }),
            value: 0n,
          },
        ];

        const smartAccountClient = await safeAA(fuse, user.suborgId, user.signWith);

        const result = await trackTransaction(
          {
            type: TransactionType.BRIDGE_DEPOSIT,
            title: `Withdraw soUSD to Fuse`,
            shortTitle: `Withdraw soUSD`,
            amount,
            symbol: 'soUSD', // Source symbol - swapping soUSD to USDC
            chainId: fuse.id,
            fromAddress: user.safeAddress,
            toAddress: destinationAddress,
            metadata: {
              description: `Withdraw ${amount} soUSD to ${toAddress}`,
              tokenAddress: ADDRESSES.fuse.vault,
            },
          },
          onUserOpHash =>
            executeTransactions(
              smartAccountClient,
              transactions,
              'Fast withdraw failed',
              fuse,
              onUserOpHash,
            ),
        );

        const transaction_result =
          result && typeof result === 'object' && 'transaction' in result
            ? result.transaction
            : result;

        if (transaction_result === USER_CANCELLED_TRANSACTION) {
          const error = new Error('User cancelled transaction');
          track(TRACKING_EVENTS.FAST_WITHDRAW_CANCELLED, {
            amount: amount,
            toAddress: toAddress,
            from_chain: fuse.id,
            source: 'useFastWithdraw',
          });
          Sentry.captureException(error, {
            tags: {
              operation: 'fast_withdraw',
              step: 'execution',
              reason: 'user_cancelled',
            },
            extra: {
              amount,
              userAddress: user.safeAddress,
              destinationAddress,
              chainId: fuse.id,
            },
            user: {
              id: user?.userId,
              address: user?.safeAddress,
            },
          });
          throw error;
        }

        track(TRACKING_EVENTS.BRIDGE_TO_ARBITRUM_COMPLETED, {
          amount: amount,
          transaction_hash: transaction_result.transactionHash,
          from_chain: fuse.id,
          source: 'useFastWithdraw',
        });

        Sentry.addBreadcrumb({
          message: 'Fast withdraw transaction successful',
          category: 'bridge',
          data: {
            amount,
            transactionHash: transaction_result.transactionHash,
            userAddress: user.safeAddress,
            toAddress: toAddress,
            chainId: fuse.id,
          },
        });

        setFastWithdrawStatus(Status.SUCCESS);
        return transaction_result;
      } catch (error) {
        console.error(error);

        track(TRACKING_EVENTS.FAST_WITHDRAW_FAILED, {
          amount: amount,
          from_chain: fuse.id,
          error: error instanceof Error ? error.message : 'Unknown error',
          user_cancelled: String(error).includes('cancelled'),
          step: 'execution',
          source: 'useFastWithdraw',
        });

        Sentry.captureException(error, {
          tags: {
            operation: 'fast_withdraw',
            step: 'execution',
          },
          extra: {
            amount,
            userAddress: user?.safeAddress,
            chainId: fuse.id,
            errorMessage: error instanceof Error ? error.message : 'Unknown error',
            fastWithdrawStatus,
          },
          user: {
            id: user?.suborgId,
            address: user?.safeAddress,
          },
        });

        setFastWithdrawStatus(Status.ERROR);
        setError(error instanceof Error ? error.message : 'Unknown error');
        throw error;
      }
    },
    [user, safeAA, trackTransaction, fastWithdrawStatus],
  );

  return { fastWithdraw, fastWithdrawStatus, error };
};

export default useFastWithdraw;
