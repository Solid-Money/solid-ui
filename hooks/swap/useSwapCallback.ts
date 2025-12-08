import * as Sentry from '@sentry/react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { algebraRouterConfig } from '@/generated/wagmi';
import { useActivity } from '@/hooks/useActivity';
import { executeTransactions, USER_CANCELLED_TRANSACTION } from '@/lib/execute';
import { TransactionType } from '@/lib/types';

import { SwapCallbackState } from '@/lib/types/swap-state';
import { Currency, Percent, Trade, TradeType } from '@cryptoalgebra/fuse-sdk';
import { Address, encodeFunctionData, erc20Abi } from 'viem';
import { fuse } from 'viem/chains';
import { useApproveCallbackFromTrade } from '../useApprove';
import { TransactionSuccessInfo, useTransactionAwait } from '../useTransactionAwait';
import useUser from '../useUser';
import { useSwapCallArguments } from './useSwapCallArguments';

interface SwapCallEstimate {
  calldata: string;
  value: bigint;
}

interface SuccessfulCall extends SwapCallEstimate {
  calldata: string;
  value: bigint;
  gasEstimate: bigint;
}

// interface FailedCall extends SwapCallEstimate {
//   calldata: string;
//   value: bigint;
//   error: Error;
// }

export function useSwapCallback(
  trade: Trade<Currency, Currency, TradeType> | undefined,
  allowedSlippage: Percent,
  successInfo?: TransactionSuccessInfo,
) {
  const { user, safeAA } = useUser();
  const { trackTransaction } = useActivity();
  const account = user?.safeAddress;

  const [bestCall, setBestCall] = useState<SuccessfulCall | SwapCallEstimate | undefined>(undefined);
  const [swapData, setSwapData] = useState<any>(null);
  const [isSendingSwap, setIsSendingSwap] = useState(false);

  const swapCalldata = useSwapCallArguments(trade, allowedSlippage);

  useEffect(() => {
    function findBestCall() {
      if (!swapCalldata || !account) return;

      setBestCall(undefined);

      // For AA wallets, we skip simulation entirely
      // The bundler and paymaster will handle validation and gas estimation
      if (swapCalldata.length > 0) {
        const { calldata, value: _value } = swapCalldata[0]; // Use the first valid call

        if (!calldata || !_value) {
          console.warn('Invalid swap calldata');
          return;
        }

        const value = BigInt(_value);


        // Set the best call without simulation
        // The AA infrastructure will handle the actual gas estimation
        setBestCall({
          calldata,
          value,
          gasEstimate: 500000n, // Conservative estimate for AA transactions
        });

        Sentry.addBreadcrumb({
          message: 'Swap call prepared for AA wallet',
          category: 'swap',
          level: 'info',
          data: {
            account,
            value: value.toString(),
            hasCalldata: !!calldata,
          },
        });
      }
    }

    findBestCall();
  }, [swapCalldata, account]);

  // Get approval info
  const { approvalConfig, needAllowance } = useApproveCallbackFromTrade(trade, allowedSlippage);

  // For token inputs, check if we need approval
  const isTokenInput = trade?.inputAmount.currency.isToken;

  // Get the actual router address from swap config to ensure approval spender matches
  const actualRouterAddress = (algebraRouterConfig.address) as Address;

  const swapConfig = useMemo(() => {
    if (!bestCall) return undefined;


    return {
      request: {
        address: actualRouterAddress,
        abi: algebraRouterConfig.abi,
        functionName: 'multicall' as const,
        args: [bestCall.calldata as unknown as `0x${string}`[]] as const,
        value: bestCall.value,
      },
    };
  }, [bestCall, actualRouterAddress]);


  const swapCallback = useCallback(async () => {
    if (!trade || !swapConfig || !account || !user?.suborgId || !user?.signWith) {
      return;
    }

    try {
      setIsSendingSwap(true);

      const transactions: Array<{ to: Address; data: `0x${string}`; value: bigint }> = [];

      // Add approval transaction if needed
      if (needAllowance || (isTokenInput && !approvalConfig)) {
        if (approvalConfig) {

          Sentry.addBreadcrumb({
            message: 'Adding approval transaction',
            category: 'swap',
            level: 'debug',
            data: {
              tokenAddress: approvalConfig.request.address,
              spender: approvalConfig.request.args?.[0],
              amount: approvalConfig.request.args?.[1]?.toString(),
            },
          });

          transactions.push({
            to: approvalConfig.request.address,
            data: encodeFunctionData({
              abi: approvalConfig.request.abi,
              functionName: approvalConfig.request.functionName,
              args: approvalConfig.request.args,
            }),
            value: 0n,
          });
        } else if (trade.inputAmount.currency.isToken) {
          // Generate a fallback approval transaction

          // Create max approval transaction as fallback
          const maxApproval = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';
          transactions.push({
            to: trade.inputAmount.currency.address as Address,
            data: encodeFunctionData({
              abi: erc20Abi,
              functionName: 'approve',
              args: [actualRouterAddress, BigInt(maxApproval)],
            }),
            value: 0n,
          });

          Sentry.addBreadcrumb({
            message: 'Adding fallback approval transaction',
            category: 'swap',
            level: 'warning',
            data: {
              tokenAddress: trade.inputAmount.currency.address,
              spender: actualRouterAddress,
              amount: 'MAX',
            },
          });
        }
      }

      Sentry.addBreadcrumb({
        message: 'Adding swap transaction',
        category: 'swap',
        level: 'debug',
        data: {
          routerAddress: swapConfig.request.address,
          value: swapConfig.request.value?.toString(),
          inputAmount: trade.inputAmount?.toSignificant(),
          outputAmount: trade.outputAmount?.toSignificant(),
        },
      });

      // Add swap transaction
      transactions.push({
        to: swapConfig.request.address,
        data: encodeFunctionData({
          abi: swapConfig.request.abi,
          functionName: swapConfig.request.functionName,
          args: swapConfig.request.args,
        }),
        value: swapConfig.request.value || 0n,
      });

      if (transactions.length === 0) {
        throw new Error('No transactions to execute - this indicates a configuration issue');
      }

      const smartAccountClient = await safeAA(fuse, user.suborgId, user.signWith);

      const result = await trackTransaction(
        {
          type: TransactionType.SWAP,
          title: `Swap ${trade.inputAmount.currency.symbol} for ${trade.outputAmount.currency.symbol}`,
          shortTitle: `${trade.inputAmount.currency.symbol} → ${trade.outputAmount.currency.symbol}`,
          amount: trade.inputAmount.toSignificant(6),
          symbol: trade.inputAmount.currency.symbol || '',
          chainId: fuse.id,
          fromAddress: user.safeAddress,
          toAddress: swapConfig.request.address,
          metadata: {
            slippage: allowedSlippage.toSignificant(3),
            platform: 'algebra',
            inputToken: trade.inputAmount.currency.symbol,
            outputToken: trade.outputAmount.currency.symbol,
            inputAmount: trade.inputAmount.toSignificant(6),
            outputAmount: trade.outputAmount.toSignificant(6),
          },
        },
        (onUserOpHash) => executeTransactions(
          smartAccountClient,
          transactions,
          'Swap failed',
          fuse,
          onUserOpHash
        )
      );

      const transaction = result && typeof result === 'object' && 'transaction' in result
        ? result.transaction
        : result;

      if (transaction === USER_CANCELLED_TRANSACTION) {
        return;
      }

      Sentry.addBreadcrumb({
        message: 'Swap executed successfully',
        category: 'swap',
        level: 'info',
        data: {
          txHashes: result,
          transactionCount: transactions.length,
        },
      });

      // Transaction successful - AA wallet handles receipt tracking
      setSwapData(result);

      // Call success callback immediately after transaction completes
      // This ensures the success modal is shown even if useTransactionAwait has timing issues
      if (successInfo?.onSuccess) {
        successInfo.onSuccess();
      }
    } catch (error: any) {
      console.error('Swap execution failed:', error);

      // Check if the error is the USER_CANCELLED_TRANSACTION symbol itself
      if (error === USER_CANCELLED_TRANSACTION) {
        return;
      }

      // Also check for user cancellation in error messages
      const errorMessage = error?.message?.toLowerCase() || '';
      if (errorMessage.includes('user cancelled') ||
        errorMessage.includes('user denied') ||
        errorMessage.includes('user rejected')) {
        return;
      }

      Sentry.captureException(error, {
        tags: {
          type: 'swap_execution_failed',
          account,
        },
        extra: {
          trade: {
            inputAmount: trade.inputAmount?.toSignificant(),
            outputAmount: trade.outputAmount?.toSignificant(),
            tradeType: trade.tradeType,
            inputCurrency: trade.inputAmount.currency.symbol,
            outputCurrency: trade.outputAmount.currency.symbol,
          },
          errorMessage: error?.message,
          errorDetails: error?.details,
        },
      });

      throw error;
    } finally {
      setIsSendingSwap(false);
    }
  }, [trade, swapConfig, approvalConfig, needAllowance, isTokenInput, account, user, safeAA, allowedSlippage, successInfo, trackTransaction]);

  const { isLoading } = useTransactionAwait(swapData?.transactionHash, successInfo);

  return useMemo(() => {
    if (!trade || !swapConfig) {
      return {
        state: SwapCallbackState.INVALID,
        callback: undefined,
        error: 'Missing trade or configuration',
        isLoading: false,
        needAllowance,
      };
    }

    return {
      state: SwapCallbackState.VALID,
      callback: swapCallback,
      error: undefined,
      isLoading: isSendingSwap || isLoading,
      needAllowance,
    };
  }, [trade, swapConfig, swapCallback, swapData, isSendingSwap, needAllowance]);
}