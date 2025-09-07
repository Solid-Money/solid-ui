import * as Sentry from '@sentry/react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { algebraRouterConfig } from '@/generated/wagmi';
import { executeTransactions, USER_CANCELLED_TRANSACTION } from '@/lib/execute';

import { SwapCallbackState } from '@/lib/types/swap-state';
import { Currency, Percent, Trade, TradeType } from '@cryptoalgebra/fuse-sdk';
import { Address, encodeFunctionData } from 'viem';
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

        console.log(`📦 Preparing swap for AA wallet (no simulation):`, {
          router: algebraRouterConfig.address,
          account,
          value: value.toString(),
          calldataPreview: calldata?.slice(0, 100),
        });

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

  // For token inputs, we ALWAYS need approval - override the hook if it's wrong
  const isTokenInput = trade?.inputAmount.currency.isToken;
  const actualNeedAllowance = isTokenInput ? true : needAllowance;

  console.log('🔍 Approval Analysis:', {
    isTokenInput,
    originalNeedAllowance: needAllowance,
    actualNeedAllowance,
    hasApprovalConfig: !!approvalConfig,
    tokenSymbol: isTokenInput ? trade.inputAmount.currency.symbol : 'N/A',
    tokenAddress: isTokenInput ? trade.inputAmount.currency.address : 'N/A',
  });

  // If we need approval but don't have config, this is a critical error
  if (actualNeedAllowance && !approvalConfig) {
    console.error('❌ CRITICAL: Need approval but no approval config generated!', {
      token: trade?.inputAmount.currency?.isToken ? trade?.inputAmount.currency.address : 'NATIVE',
      symbol: trade?.inputAmount.currency.symbol,
      amount: trade?.inputAmount.toSignificant(),
    });
  }

  // Get the actual router address from swap config to ensure approval spender matches
  const actualRouterAddress = (algebraRouterConfig.address) as Address;

  const swapConfig = useMemo(() => {
    if (!bestCall) return undefined;

    console.log('🔧 Preparing swap config for AA wallet:', {
      hasApproval: needAllowance,
      routerAddress: actualRouterAddress,
      value: bestCall.value.toString(),
    });

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
      console.warn('Missing required data for swap:', {
        hasTrade: !!trade,
        hasSwapConfig: !!swapConfig,
        hasAccount: !!account,
        hasUser: !!user,
      });
      return;
    }

    try {
      setIsSendingSwap(true);


      const transactions = [];

      // Debug swap details before execution
      console.log('🔍 Pre-execution debug:', {
        inputToken: {
          symbol: trade.inputAmount.currency.symbol,
          address: trade.inputAmount.currency.isToken ? trade.inputAmount.currency.address : 'NATIVE',
          amount: trade.inputAmount.toSignificant(),
        },
        outputToken: {
          symbol: trade.outputAmount.currency.symbol,
          address: trade.outputAmount.currency.isToken ? trade.outputAmount.currency.address : 'NATIVE',
        },
        needAllowance,
        actualNeedAllowance,
        hasApprovalConfig: !!approvalConfig,
        router: swapConfig.request.address,
        slippage: allowedSlippage?.toSignificant(2),
      });

      // Add approval transaction if needed (using actualNeedAllowance for safety)
      if (actualNeedAllowance && approvalConfig) {
        console.log('🔐 Adding approval transaction for AA wallet:', {
          token: approvalConfig.request.address,
          spender: approvalConfig.request.args?.[0],
          amount: approvalConfig.request.args?.[1]?.toString(),
        });

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
        // This is a critical check - if we need a token but have no approval, the swap will fail
        console.warn('⚠️ Token swap attempted without approval:', {
          token: trade.inputAmount.currency.address,
          symbol: trade.inputAmount.currency.symbol,
          amount: trade.inputAmount.toSignificant(),
          originalNeedAllowance: needAllowance,
          actualNeedAllowance,
          hasApprovalConfig: !!approvalConfig,
        });
      }

      // Add swap transaction
      console.log('Adding swap transaction for AA wallet');

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

      console.log(`📤 Executing ${transactions.length} transaction(s) through AA wallet:`, {
        transactionTypes: transactions.map((_, i) => i === 0 && actualNeedAllowance ? 'approval' : 'swap'),
        inputAmount: trade.inputAmount.toSignificant(),
        outputAmount: trade.outputAmount.toSignificant(),
      });

      const smartAccountClient = await safeAA(fuse, user.suborgId, user.signWith);

      const result = await executeTransactions(
        smartAccountClient,
        transactions,
        'Swap failed',
        fuse,
      );

      if (result === USER_CANCELLED_TRANSACTION) {
        return;
      }

      if (result?.length > 0) {
        console.log('✅ Swap transactions sent:', result);

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
      }
    } catch (error: any) {
      console.error('Swap execution failed:', error);

      if (error?.message?.includes(USER_CANCELLED_TRANSACTION)) {
        console.log('User cancelled the transaction');
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
  }, [trade, swapConfig, approvalConfig, actualNeedAllowance, account, user, safeAA]);

  const { isLoading } = useTransactionAwait(swapData?.transactionHash, successInfo);

  return useMemo(() => {
    if (!trade || !swapConfig) {
      return {
        state: SwapCallbackState.INVALID,
        callback: undefined,
        error: 'Missing trade or configuration',
        isLoading: false,
        needAllowance: actualNeedAllowance,
      };
    }

    return {
      state: SwapCallbackState.VALID,
      callback: swapCallback,
      error: undefined,
      isLoading: isSendingSwap || isLoading,
      needAllowance: actualNeedAllowance,
    };
  }, [trade, swapConfig, swapCallback, swapData, isSendingSwap]);
}