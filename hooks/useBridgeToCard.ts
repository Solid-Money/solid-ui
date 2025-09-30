import { USDC_STARGATE } from '@/constants/addresses';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { useActivity } from '@/hooks/useActivity';
import BridgePayamster_ABI from '@/lib/abis/BridgePayamster';
import ERC20_ABI from '@/lib/abis/ERC20';
import { track } from '@/lib/analytics';
import { getStargateQuote } from '@/lib/api';
import { ADDRESSES } from '@/lib/config';
import { executeTransactions, USER_CANCELLED_TRANSACTION } from '@/lib/execute';
import { StargateQuoteParams, Status, TransactionType } from '@/lib/types';
import * as Sentry from '@sentry/react-native';
import { Address } from 'abitype';
import { useCallback, useState } from 'react';
import { TransactionReceipt } from 'viem';
import { fuse } from 'viem/chains';
import { encodeFunctionData, parseUnits } from 'viem/utils';
import { useCardDetails } from './useCardDetails';
import useUser from './useUser';

type BridgeResult = {
  bridge: (amount: string) => Promise<TransactionReceipt>;
  bridgeStatus: Status;
  error: string | null;
};

const useBridgeToCard = (): BridgeResult => {
  const { user, safeAA } = useUser();
  const { trackTransaction } = useActivity();
  const { data: cardDetails } = useCardDetails();
  const [bridgeStatus, setBridgeStatus] = useState<Status>(Status.IDLE);
  const [error, setError] = useState<string | null>(null);

  const bridge = useCallback(
    async (amount: string) => {
      try {
        if (!user) {
          const error = new Error('User is not selected');
          track(TRACKING_EVENTS.BRIDGE_TO_ARBITRUM_ERROR, {
            amount: amount,
            error: 'User not found',
            step: 'validation',
            source: 'useBridgeToCard',
          });
          Sentry.captureException(error, {
            tags: {
              operation: 'bridge_to_card',
              step: 'validation',
            },
            extra: {
              amount,
              hasUser: !!user,
            },
          });
          throw error;
        }

        // Get card's Arbitrum funding address
        const arbitrumFundingAddress = cardDetails?.additional_funding_instructions?.find(
          instruction => instruction.chain === 'arbitrum',
        );

        if (!arbitrumFundingAddress) {
          const error = new Error('Arbitrum funding address not found for card');
          track(TRACKING_EVENTS.BRIDGE_TO_ARBITRUM_ERROR, {
            amount: amount,
            error: 'Arbitrum funding address not found',
            step: 'validation',
            source: 'useBridgeToCard',
          });
          Sentry.captureException(error, {
            tags: {
              operation: 'bridge_to_card',
              step: 'validation',
            },
            extra: {
              amount,
              hasCardDetails: !!cardDetails,
            },
          });
          throw error;
        }

        track(TRACKING_EVENTS.BRIDGE_TO_ARBITRUM_INITIATED, {
          amount: amount,
          from_chain: fuse.id,
          to_chain: 42161, // Arbitrum
          source: 'useBridgeToCard',
        });

        setBridgeStatus(Status.PENDING);
        setError(null);

        const destinationAddress = arbitrumFundingAddress.address;
        const amountWei = parseUnits(amount, 6);

        Sentry.addBreadcrumb({
          message: 'Starting bridge to Card transaction',
          category: 'bridge',
          data: {
            amount,
            amountWei: amountWei.toString(),
            userAddress: user.safeAddress,
            destinationAddress,
            chainId: fuse.id,
          },
        });

        // Get Stargate quote for taxi route
        // Calculate minimum destination amount (95% of source amount for 5% slippage tolerance)
        const dstAmountMin = (amountWei * 95n) / 100n;

        const quoteParams: StargateQuoteParams = {
          srcToken: USDC_STARGATE,
          srcChainKey: 'fuse', // Fuse chain key
          dstToken: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', // USDC on Arbitrum
          dstChainKey: 'arbitrum', // Arbitrum chain key
          srcAddress: ADDRESSES.fuse.bridgePaymasterAddress,
          dstAddress: destinationAddress,
          srcAmount: amountWei.toString(),
          dstAmountMin: dstAmountMin.toString(),
        };
        const quote = await getStargateQuote(quoteParams);
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

        console.log('Stargate quote:', {
          taxiQuote,
          bridgeStep,
          transaction: bridgeStep?.transaction,
          nativeFeeAmount: nativeFeeAmount.toString(),
        });

        const transactions = [
          // 1) Move USDC.e from Safe to BridgePaymaster
          {
            to: USDC_STARGATE,
            data: encodeFunctionData({
              abi: ERC20_ABI,
              functionName: 'transfer',
              args: [ADDRESSES.fuse.bridgePaymasterAddress, amountWei],
            }),
            value: 0n,
          },
          // 2) Perform the Stargate taxi call via BridgePaymaster, forwarding the fee it now holds
          {
            to: ADDRESSES.fuse.bridgePaymasterAddress,
            data: encodeFunctionData({
              abi: BridgePayamster_ABI,
              functionName: 'callWithValue',
              args: [
                transaction.to as Address,
                '0x05921740', // send function selector
                transaction.data as `0x${string}`,
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
            title: `Bridge ${amount} USDC to Card`,
            shortTitle: `Bridge ${amount}`,
            amount,
            symbol: 'USDC',
            chainId: fuse.id,
            fromAddress: user.safeAddress,
            toAddress: destinationAddress,
            metadata: {
              description: `Bridge ${amount} USDC from Fuse to Card on Arbitrum`,
              fee: transaction.value,
            },
          },
          onUserOpHash =>
            executeTransactions(
              smartAccountClient,
              transactions,
              'Bridge to Card failed',
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
          track(TRACKING_EVENTS.BRIDGE_TO_ARBITRUM_CANCELLED, {
            amount: amount,
            fee: transaction.value,
            from_chain: fuse.id,
            to_chain: 42161,
            source: 'useBridgeToCard',
          });
          Sentry.captureException(error, {
            tags: {
              operation: 'bridge_to_card',
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
          to_chain: 42161,
          source: 'useBridgeToCard',
        });

        Sentry.addBreadcrumb({
          message: 'Bridge to Card transaction successful',
          category: 'bridge',
          data: {
            amount,
            transactionHash: transaction_result.transactionHash,
            userAddress: user.safeAddress,
            destinationAddress,
            chainId: fuse.id,
          },
        });

        setBridgeStatus(Status.SUCCESS);
        return transaction_result;
      } catch (error) {
        console.error(error);

        track(TRACKING_EVENTS.BRIDGE_TO_ARBITRUM_ERROR, {
          amount: amount,
          from_chain: fuse.id,
          to_chain: 42161,
          error: error instanceof Error ? error.message : 'Unknown error',
          user_cancelled: String(error).includes('cancelled'),
          step: 'execution',
          source: 'useBridgeToCard',
        });

        Sentry.captureException(error, {
          tags: {
            operation: 'bridge_to_card',
            step: 'execution',
          },
          extra: {
            amount,
            userAddress: user?.safeAddress,
            chainId: fuse.id,
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
    [user, cardDetails, safeAA, trackTransaction, bridgeStatus],
  );

  return { bridge, bridgeStatus, error };
};

export default useBridgeToCard;
