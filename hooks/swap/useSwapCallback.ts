import { Currency, Percent, Trade, TradeType } from '@cryptoalgebra/fuse-sdk';
import * as Sentry from '@sentry/react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { algebraRouterConfig, useSimulateAlgebraRouterMulticall } from '@/generated/wagmi';
import { executeTransactions, USER_CANCELLED_TRANSACTION } from '@/lib/execute';

import { SwapCallbackState } from '@/lib/types/swap-state';
import { publicClient } from '@/lib/wagmi';
import { encodeFunctionData, getContract } from 'viem';
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

interface FailedCall extends SwapCallEstimate {
  calldata: string;
  value: bigint;
  error: Error;
}

export function useSwapCallback(
  trade: Trade<Currency, Currency, TradeType> | undefined,
  allowedSlippage: Percent,
  successInfo?: TransactionSuccessInfo,
) {
  const { user, safeAA } = useUser();
  const { approvalConfig, needAllowance } = useApproveCallbackFromTrade(trade, allowedSlippage);
  const account = user?.safeAddress;

  const [bestCall, setBestCall] = useState<SuccessfulCall | SwapCallEstimate | undefined>(undefined);
  const [swapData, setSwapData] = useState<any>(null);
  const [isSendingSwap, setIsSendingSwap] = useState(false);

  const swapCalldata = useSwapCallArguments(trade, allowedSlippage);

  useEffect(() => {
    async function findBestCall() {
      if (!swapCalldata || !account) return;

      setBestCall(undefined);

      const algebraRouter = getContract({
        ...algebraRouterConfig,
        client: publicClient(fuse.id),
      });

      const calls: (SuccessfulCall | FailedCall | SwapCallEstimate)[] = await Promise.all(
        swapCalldata.map(({ calldata, value: _value }) => {
          const value = BigInt(_value);

          return algebraRouter.estimateGas
            .multicall([calldata], {
              account,
              value,
            })
            .then((gasEstimate) => ({
              calldata,
              value,
              gasEstimate,
            }))
            .catch((gasError) => {
              return algebraRouter.simulate
                .multicall([calldata], {
                  account,
                  value,
                })
                .then(() => ({
                  calldata,
                  value,
                  error: new Error(
                    `Unexpected issue with estimating the gas. Please try again. ${gasError}`
                  ),
                }))
                .catch((callError) => {
                  console.warn('Swap simulation failed:', callError);
                  Sentry.captureException(callError, {
                    tags: {
                      type: 'swap_simulation_failed',
                      account,
                      value: value.toString(),
                    },
                    extra: {
                      calldata,
                      trade: trade ? {
                      inputAmount: trade.inputAmount?.toSignificant(),
                      outputAmount: trade.outputAmount?.toSignificant(),
                      tradeType: trade.tradeType,
                    } : undefined,
                      allowedSlippage: allowedSlippage?.toSignificant(2),
                    },
                  });
                  return {
                    calldata,
                    value,
                    error: new Error('Swap simulation failed'),
                  }
                });
            });
        })
      );

      let bestCallOption: SuccessfulCall | SwapCallEstimate | undefined = calls.find(
        (el, ix, list): el is SuccessfulCall =>
          'gasEstimate' in el && (ix === list.length - 1 || 'gasEstimate' in list[ix + 1])
      );

      if (!bestCallOption) {
        const errorCalls = calls.filter((call): call is FailedCall => 'error' in call);
        if (errorCalls.length > 0) {
          console.warn('All swap calls failed:', errorCalls[errorCalls.length - 1].error);
          Sentry.captureException(errorCalls[errorCalls.length - 1].error, {
            tags: {
              type: 'all_swap_calls_failed',
              account,
            },
            extra: {
              errorCalls: errorCalls.map(e => ({ error: e.error.message, value: e.value.toString() })),
              trade: trade ? {
            inputAmount: trade.inputAmount?.toSignificant(),
            outputAmount: trade.outputAmount?.toSignificant(),
            tradeType: trade.tradeType,
          } : undefined,
            },
          });
          throw errorCalls[errorCalls.length - 1].error;
        }
        const firstNoErrorCall = calls.find((call): call is SwapCallEstimate => !('error' in call));
        if (!firstNoErrorCall) {
          console.warn('Could not estimate gas for the swap - no valid calls found');
          const error = new Error('Unexpected error. Could not estimate gas for the swap.');
          Sentry.captureException(error, {
            tags: {
              type: 'no_valid_swap_calls',
              account,
            },
            extra: {
              trade: trade ? {
            inputAmount: trade.inputAmount?.toSignificant(),
            outputAmount: trade.outputAmount?.toSignificant(),
            tradeType: trade.tradeType,
          } : undefined,
              callsCount: calls.length,
            },
          });
          throw error;
        }
        bestCallOption = firstNoErrorCall;
      }

      setBestCall(bestCallOption);
    }

    // For Safe wallets, always skip the simulation and use first call
    if (swapCalldata && account) {
      findBestCall().catch((error) => {
        console.warn('Unhandled error in findBestCall:', error);
        Sentry.captureException(error, {
          tags: {
            type: 'find_best_call_error',
            account,
          },
          extra: {
            swapCalldataLength: swapCalldata.length,
            trade: trade ? {
            inputAmount: trade.inputAmount?.toSignificant(),
            outputAmount: trade.outputAmount?.toSignificant(),
            tradeType: trade.tradeType,
          } : undefined,
          },
        });
        if (swapCalldata.length > 0) {
          console.log('Using the first call');
          setBestCall(swapCalldata[0]);
        }
      });
    }
  }, [swapCalldata, account]);

  const { data: swapConfig } = useSimulateAlgebraRouterMulticall({
    args: bestCall && [bestCall.calldata as unknown as `0x${string}`[]],
    value: BigInt(bestCall?.value || 0),
    gas:
      bestCall && 'gasEstimate' in bestCall
        ? (bestCall.gasEstimate * (10000n + 2000n)) / 10000n
        : undefined,
    chainId: fuse.id,
    query: {
      enabled: Boolean(bestCall),
    },
  });

  const swapCallback = useCallback(async () => {
    if (!swapConfig || !user?.suborgId || !user?.signWith || !account) {
      return;
    }
    try {
      setIsSendingSwap(true);
      const smartAccountClient = await safeAA(fuse, user?.suborgId, user?.signWith);
      const transactions = [];

      // Add approve transaction if needed
      if (needAllowance && approvalConfig) {
        transactions.push({
          to: approvalConfig.request.address,
          data: encodeFunctionData({
            abi: approvalConfig.request.abi,
            functionName: approvalConfig.request.functionName,
            args: approvalConfig.request.args,
          }),
        });
      }

      // Add swap transaction
      transactions.push({
        to: swapConfig?.request.address,
        data: encodeFunctionData({
          abi: swapConfig!.request.abi,
          functionName: swapConfig!.request.functionName,
          args: swapConfig?.request.args as readonly [readonly `0x${string}`[]],
        }),
        value: swapConfig?.request.value,
      });

      const result = await executeTransactions(
        smartAccountClient,
        transactions,
        'Swap failed',
        fuse,
      );

      if (result === USER_CANCELLED_TRANSACTION) {
        return;
      }

      setSwapData(result);
      return result;
    } catch (error) {
      console.error('Swap failed', error);
      Sentry.captureException(error, {
        tags: {
          type: 'swap_execution_failed',
          account,
          needAllowance: String(needAllowance),
        },
        extra: {
          trade: trade ? {
            inputAmount: trade.inputAmount?.toSignificant(),
            outputAmount: trade.outputAmount?.toSignificant(),
            tradeType: trade.tradeType,
          } : undefined,
          allowedSlippage: allowedSlippage?.toSignificant(2),
          bestCall,
          swapConfig,
        },
      });
    } finally {
      setIsSendingSwap(false);
    }
  }, [swapConfig, user?.suborgId, user?.signWith, account, safeAA, needAllowance, approvalConfig, bestCall]);

  const { isLoading, isSuccess } = useTransactionAwait(swapData?.transactionHash, successInfo);

  return useMemo(() => {
    if (!trade)
      return {
        state: SwapCallbackState.INVALID,
        callback: null,
        error: 'No trade was found',
        isLoading: false,
        isSuccess: false,
        swapConfig: swapConfig,
        needAllowance,
      };

    return {
      state: SwapCallbackState.VALID,
      callback: swapCallback,
      error: null,
      isLoading: isSendingSwap || isLoading,
      isSuccess,
      swapConfig: swapConfig,
      needAllowance,
    };
  }, [trade, swapCalldata, swapCallback, swapConfig, isLoading, isSuccess, isSendingSwap, needAllowance, approvalConfig]);
}
