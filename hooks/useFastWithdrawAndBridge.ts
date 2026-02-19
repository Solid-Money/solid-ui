import { USDC_STARGATE } from '@/constants/addresses';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { useActivityActions } from '@/hooks/useActivityActions';
import BridgePayamster_ABI from '@/lib/abis/BridgePayamster';
import { FastWithdrawManager_ABI } from '@/lib/abis/FastWithdrawManager';
import { track } from '@/lib/analytics';
import { getStargateQuote } from '@/lib/api';
import { ADDRESSES } from '@/lib/config';
import { executeTransactions, USER_CANCELLED_TRANSACTION } from '@/lib/execute';
import { StargateQuoteParams, Status, TransactionType } from '@/lib/types';
import { getStargateChainId, getStargateChainKey, getStargateToken } from '@/lib/utils/stargate';
import * as Sentry from '@sentry/react-native';
import { Address } from 'abitype';
import { useCallback, useState } from 'react';
import { erc20Abi, pad, TransactionReceipt } from 'viem';
import { fuse } from 'viem/chains';
import { encodeFunctionData, parseUnits } from 'viem/utils';
import useUser from './useUser';

type BridgeResult = {
  fastWithdrawAndBridge: (
    amount: string,
    minAmount: string,
    toAddress: Address,
    toChainId: number,
  ) => Promise<TransactionReceipt>;
  fastWithdrawStatus: Status;
  error: string | null;
};

const useFastWithdrawAndBridge = (): BridgeResult => {
  const { user, safeAA } = useUser();
  const { trackTransaction } = useActivityActions();
  const [fastWithdrawStatus, setFastWithdrawStatus] = useState<Status>(Status.IDLE);
  const [error, setError] = useState<string | null>(null);

  const fastWithdrawAndBridge = useCallback(
    async (amount: string, minAmount: string, toAddress: Address, toChainId: number) => {
      try {
        if (!user) {
          const error = new Error('User is not selected');
          track(TRACKING_EVENTS.FAST_WITHDRAW_FAILED, {
            amount: amount,
            toAddress: toAddress,
            error: 'User not found',
            step: 'validation',
            source: 'useFastWithdrawAndBridge',
          });
          Sentry.captureException(error, {
            tags: {
              operation: 'fast_withdraw_and_bridge',
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
            source: 'useFastWithdrawAndBridge',
          });
          Sentry.captureException(error, {
            tags: {
              operation: 'fast_withdraw_and_bridge',
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
          to_chain: toChainId,
          source: 'useFastWithdrawAndBridge',
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
            toChainId: toChainId,
          },
        });

        const quoteParams: StargateQuoteParams = {
          srcToken: USDC_STARGATE,
          srcChainKey: 'fuse', // Fuse chain key
          dstToken: getStargateToken(toChainId) as string,
          dstChainKey: getStargateChainKey(toChainId) as string,
          srcAddress: ADDRESSES.fuse.bridgePaymasterAddress,
          dstAddress: destinationAddress,
          srcAmount: amountWei.toString(),
          dstAmountMin: minAmount,
        };
        let quote;
        try {
          quote = await getStargateQuote(quoteParams);
        } catch (quoteError) {
          throw quoteError;
        }
        const taxiQuote = quote.quotes.find(q => q.route.includes('taxi'));

        if (!taxiQuote) {
          throw new Error('Taxi route not available from Stargate');
        }

        if (taxiQuote.error) {
          throw new Error(`Stargate quote error: ${taxiQuote.error}`);
        }

        // Get the transaction from the first step (should be the bridge step)
        const bridgeStep = taxiQuote.steps.find(step => step.type === 'bridge');

        if (!bridgeStep) {
          throw new Error('No bridge step found in Stargate quote');
        }

        const { transaction } = bridgeStep;
        const nativeFeeAmount = BigInt(transaction.value);

        const sendParam = {
          dstEid: getStargateChainId(toChainId) as number,
          to: pad(destinationAddress as `0x${string}`, {
            size: 32,
          }),
          amountLD: amountWei,
          minAmountLD: minAmount,
          extraOptions: '0x',
          composeMsg: '0x',
          oftCmd: '0x',
        };

        const calldata = encodeFunctionData({
          abi: FastWithdrawManager_ABI,
          functionName: 'swapAndWithdrawUsingStargate',
          args: [
            transaction.to as Address,
            user.safeAddress as Address,
            amountWei,
            sendParam,
            nativeFeeAmount,
            ADDRESSES.fuse.bridgePaymasterAddress,
          ],
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
            to: ADDRESSES.fuse.bridgePaymasterAddress,
            data: encodeFunctionData({
              abi: BridgePayamster_ABI,
              functionName: 'callWithValue',
              args: [
                ADDRESSES.fuse.fastWithdrawManager,
                '0x106cb049', // swapAndWithdrawUsingStargate function selector
                calldata,
                nativeFeeAmount, // the native to forward
              ],
            }),
            value: 0n,
          },
        ];

        const smartAccountClient = await safeAA(fuse, user.suborgId, user.signWith);

        const result = await trackTransaction(
          {
            type: TransactionType.BRIDGE_DEPOSIT,
            title: `Withdraw soUSD to ${getStargateChainKey(toChainId)}`,
            shortTitle: `Withdraw soUSD`,
            amount,
            symbol: 'soUSD', // Source symbol - swapping soUSD to USDC
            chainId: fuse.id,
            fromAddress: user.safeAddress,
            toAddress: destinationAddress,
            metadata: {
              description: `Withdraw ${amount} USDC from Fuse to ${getStargateChainKey(toChainId)}`,
              fee: transaction.value,
              sourceSymbol: 'soUSD', // Track source symbol for display
              tokenAddress: ADDRESSES.fuse.vault,
            },
          },
          onUserOpHash =>
            executeTransactions(
              smartAccountClient,
              transactions,
              'Fast withdraw and bridge failed',
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
            toChainId: toChainId,
            from_chain: fuse.id,
            source: 'useFastWithdrawAndBridge',
          });
          Sentry.captureException(error, {
            tags: {
              operation: 'fast_withdraw_and_bridge',
              step: 'execution',
              reason: 'user_cancelled',
            },
            extra: {
              amount,
              userAddress: user.safeAddress,
              destinationAddress,
              chainId: fuse.id,
              fee: transaction.value,
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
          fee: transaction.value,
          from_chain: fuse.id,
          to_chain: toChainId,
          source: 'useFastWithdrawAndBridge',
        });

        Sentry.addBreadcrumb({
          message: 'Fast withdraw and bridge transaction successful',
          category: 'bridge',
          data: {
            amount,
            transactionHash: transaction_result.transactionHash,
            userAddress: user.safeAddress,
            toAddress: toAddress,
            toChainId: toChainId,
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
          to_chain: toChainId,
          error: error instanceof Error ? error.message : 'Unknown error',
          user_cancelled: String(error).includes('cancelled'),
          step: 'execution',
          source: 'useFastWithdrawAndBridge',
        });

        Sentry.captureException(error, {
          tags: {
            operation: 'fast_withdraw_and_bridge',
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

  return { fastWithdrawAndBridge, fastWithdrawStatus, error };
};

export default useFastWithdrawAndBridge;
