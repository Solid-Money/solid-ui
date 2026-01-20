import { USDC_STARGATE } from '@/constants/addresses';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { useActivity } from '@/hooks/useActivity';
import { AaveV3Pool_ABI } from '@/lib/abis/AaveV3Pool';
import BridgePayamster_ABI from '@/lib/abis/BridgePayamster';
import { CardDepositManager_ABI } from '@/lib/abis/CardDepositManager';
import { track } from '@/lib/analytics';
import { getStargateQuote } from '@/lib/api';
import { ADDRESSES } from '@/lib/config';
import { executeTransactions, USER_CANCELLED_TRANSACTION } from '@/lib/execute';
import { StargateQuoteParams, Status, TransactionType } from '@/lib/types';
import { getArbitrumFundingAddress } from '@/lib/utils';
import { publicClient } from '@/lib/wagmi';
import * as Sentry from '@sentry/react-native';
import { Address } from 'abitype';
import { useCallback, useState } from 'react';
import { erc20Abi, pad, TransactionReceipt } from 'viem';
import { readContract } from 'viem/actions';
import { fuse, mainnet } from 'viem/chains';
import { encodeFunctionData, parseUnits } from 'viem/utils';
import { useCardDetails } from './useCardDetails';
import useUser from './useUser';

// ABI for AccountantWithRateProviders getRate function
const ACCOUNTANT_ABI = [
  {
    inputs: [],
    name: 'getRate',
    outputs: [
      {
        internalType: 'uint256',
        name: 'rate',
        type: 'uint256',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

type BridgeResult = {
  borrowAndDeposit: (amount: string) => Promise<TransactionReceipt>;
  bridgeStatus: Status;
  error: string | null;
};

const soUSDLTV = 70n; // 80% LTV for soUSD (79% to avoid rounding errors)

const useBorrowAndDepositToCard = (): BridgeResult => {
  const { user, safeAA } = useUser();
  const { trackTransaction } = useActivity();
  const { data: cardDetails } = useCardDetails();
  const [bridgeStatus, setBridgeStatus] = useState<Status>(Status.IDLE);
  const [error, setError] = useState<string | null>(null);

  const borrowAndDeposit = useCallback(
    async (amountToBorrow: string) => {
      try {
        if (!user) {
          const error = new Error('User is not selected');
          track(TRACKING_EVENTS.BRIDGE_TO_ARBITRUM_ERROR, {
            amount: amountToBorrow,
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
              amount: amountToBorrow,
              hasUser: !!user,
            },
          });
          throw error;
        }

        // Get card's Arbitrum funding address
        if (!cardDetails) {
          throw new Error('Card details not found');
        }

        const arbitrumFundingAddress = getArbitrumFundingAddress(cardDetails);

        if (!arbitrumFundingAddress) {
          const error = new Error('Arbitrum funding address not found for card');
          track(TRACKING_EVENTS.BRIDGE_TO_ARBITRUM_ERROR, {
            amount: amountToBorrow,
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
              amount: amountToBorrow,
              hasCardDetails: !!cardDetails,
            },
          });
          throw error;
        }

        track(TRACKING_EVENTS.BRIDGE_TO_ARBITRUM_INITIATED, {
          amount: amountToBorrow,
          from_chain: fuse.id,
          to_chain: 42161, // Arbitrum
          source: 'useBridgeToCard',
        });

        setBridgeStatus(Status.PENDING);
        setError(null);

        const rate = await readContract(publicClient(mainnet.id), {
          address: ADDRESSES.ethereum.accountant,
          abi: ACCOUNTANT_ABI,
          functionName: 'getRate',
        });

        const destinationAddress = arbitrumFundingAddress;
        const borrowAmountWei = parseUnits(amountToBorrow, 6);
        const supplyAmountWei = (borrowAmountWei * 100n * 1000000n) / (soUSDLTV * rate);

        const supplyApproveCalldata = encodeFunctionData({
          abi: erc20Abi,
          functionName: 'approve',
          args: [ADDRESSES.fuse.aaveV3Pool, supplyAmountWei],
        }); 

        const supplyCalldata = encodeFunctionData({
          abi: AaveV3Pool_ABI,
          functionName: 'supply',
          args: [ADDRESSES.fuse.vault, supplyAmountWei, user.safeAddress as Address, 0],
        });

        const borrowCalldata = encodeFunctionData({
          abi: AaveV3Pool_ABI,
          functionName: 'borrow',
          args: [USDC_STARGATE, borrowAmountWei, 2, 0, user.safeAddress as Address],
        });

        Sentry.addBreadcrumb({
          message: 'Starting bridge to Card transaction',
          category: 'bridge',
          data: {
            amount: amountToBorrow,
            amountWei: borrowAmountWei.toString(),
            userAddress: user.safeAddress,
            destinationAddress,
            chainId: fuse.id,
          },
        });

        // Get Stargate quote for taxi route
        // Calculate minimum destination amount (95% of source amount for 5% slippage tolerance)
        const dstAmountMin = (borrowAmountWei * 95n) / 100n;

        const quoteParams: StargateQuoteParams = {
          srcToken: USDC_STARGATE,
          srcChainKey: 'fuse', // Fuse chain key
          dstToken: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', // USDC on Arbitrum
          dstChainKey: 'arbitrum', // Arbitrum chain key
          srcAddress: ADDRESSES.fuse.bridgePaymasterAddress,
          dstAddress: destinationAddress,
          srcAmount: borrowAmountWei.toString(),
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

        const sendParam = {
          dstEid: 30110,
          to: pad(destinationAddress as `0x${string}`, {
            size: 32,
          }),
          amountLD: borrowAmountWei,
          minAmountLD: dstAmountMin,
          extraOptions: '0x',
          composeMsg: '0x',
          oftCmd: '0x',
        };

        const calldata = encodeFunctionData({
          abi: CardDepositManager_ABI,
          functionName: 'depositUsingStargate',
          args: [
            transaction.to as Address,
            user.safeAddress as Address,
            sendParam,
            nativeFeeAmount,
            ADDRESSES.fuse.bridgePaymasterAddress,
          ],
        });

        const transactions = [
          {
            to: ADDRESSES.fuse.vault,
            data: supplyApproveCalldata,
            value: 0n,
          },
          {
            to: ADDRESSES.fuse.aaveV3Pool,
            data: supplyCalldata,
            value: 0n,
          },
          {
            to: ADDRESSES.fuse.aaveV3Pool,
            data: borrowCalldata,
            value: 0n,
          },
          // 1) Approve USDC.e from Safe to DepositManager
          {
            to: USDC_STARGATE,
            data: encodeFunctionData({
              abi: erc20Abi,
              functionName: 'approve',
              args: [ADDRESSES.fuse.cardDepositManager, borrowAmountWei],
            }),
            value: 0n,
          },
          // 2) Perform the Stargate taxi call via BridgePaymaster and DepositManager, forwarding the fee it now holds
          {
            to: ADDRESSES.fuse.bridgePaymasterAddress,
            data: encodeFunctionData({
              abi: BridgePayamster_ABI,
              functionName: 'callWithValue',
              args: [
                ADDRESSES.fuse.cardDepositManager,
                '0x37fe667d', // depositUsingStargate function selector
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
            type: TransactionType.BORROW_AND_DEPOSIT_TO_CARD,
            title: `Borrow and deposit to Card`,
            shortTitle: `Borrow and deposit to Card`,
            amount: amountToBorrow,
            symbol: 'USDC.e', // Source symbol - bridging USDC.e
            chainId: fuse.id,
            fromAddress: user.safeAddress,
            toAddress: arbitrumFundingAddress,
            metadata: {
              description: `Borrow and deposit ${amountToBorrow} USDC from Fuse to Card on Arbitrum`,
              fee: transaction.value,
              sourceSymbol: 'USDC.e', // Track source symbol for display
            },
          },
          onUserOpHash =>
            executeTransactions(
              smartAccountClient,
              transactions,
              'Borrow and deposit to Card failed',
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
            amount: amountToBorrow,
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
              amount: amountToBorrow,
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
          amount: amountToBorrow,
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
            amount: amountToBorrow,
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
          amount: amountToBorrow,
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
            amount: amountToBorrow,
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

  return { borrowAndDeposit, bridgeStatus, error };
};

export default useBorrowAndDepositToCard;
