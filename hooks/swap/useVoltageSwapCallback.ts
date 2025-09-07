import { useCallback, useMemo, useState } from 'react';
import * as Sentry from '@sentry/react-native';

import { executeTransactions, USER_CANCELLED_TRANSACTION } from '@/lib/execute';
import { SwapCallbackState } from '@/lib/types/swap-state';
import { Percent } from '@cryptoalgebra/fuse-sdk';
import { Address } from 'abitype';
import { encodeFunctionData } from 'viem';
import { fuse } from 'viem/chains';
import { useApproveCallbackFromVoltageTrade } from '../useApprove';
import { TransactionSuccessInfo, useTransactionAwait } from '../useTransactionAwait';
import useUser from '../useUser';
import { VoltageTrade } from './useVoltageRouter';

export function useVoltageSwapCallback(
  trade: VoltageTrade | undefined,
  allowedSlippage: Percent,
  successInfo?: TransactionSuccessInfo,
) {
  const { user, safeAA } = useUser();
  const { needAllowance, approvalConfig } =
    useApproveCallbackFromVoltageTrade(trade, allowedSlippage);
    
  // For token inputs, we ALWAYS need approval - override the hook if it's wrong
  const isTokenInput = trade?.inputAmount?.currency?.isToken;
  const actualNeedAllowance = isTokenInput ? true : needAllowance;
  
  console.log('🔍 Voltage Approval Analysis:', {
    isTokenInput,
    originalNeedAllowance: needAllowance,
    actualNeedAllowance,
    hasApprovalConfig: !!approvalConfig,
    tokenSymbol: isTokenInput ? trade?.inputAmount?.currency?.symbol : 'N/A',
    tokenAddress: isTokenInput ? trade?.inputAmount?.currency?.address : 'N/A',
  });
  const account = user?.safeAddress;
  const [swapData, setSwapData] = useState<any>(null);
  const [isSendingSwap, setIsSendingSwap] = useState(false);


  const swapCallback = useCallback(async () => {
    if (!trade || !account || !user?.suborgId || !user?.signWith) return;

    try {
      setIsSendingSwap(true);
      const smartAccountClient = await safeAA(fuse, user.suborgId, user.signWith);

      const transactions = [];

      if (actualNeedAllowance && approvalConfig) {
        console.log('🔍 Voltage Approval Debug:', {
          tokenToApprove: approvalConfig.request.address,
          spenderBeingApproved: approvalConfig.request.args?.[0],
          voltageAllowanceTarget: trade?.allowanceTarget,
          voltageTransactionTarget: trade?.to,
          isCorrect: approvalConfig.request.args?.[0] === trade?.allowanceTarget,
        });

        Sentry.addBreadcrumb({
          message: 'Adding Voltage approval transaction',
          category: 'swap',
          level: 'debug',
          data: {
            tokenAddress: approvalConfig.request.address,
            originalNeedAllowance: needAllowance,
          actualNeedAllowance,
          spender: approvalConfig.request.args?.[0],
            allowanceTarget: trade?.allowanceTarget,
            transactionTarget: trade?.to,
          },
        });

        transactions.push({
          to: approvalConfig.request.address,
          data: encodeFunctionData({
            abi: approvalConfig.request.abi,
            functionName: approvalConfig.request.functionName,
            args: approvalConfig.request.args,
          }),
        });
      }

      transactions.push({
        to: trade?.to as Address,
        data: trade?.data as `0x${string}`,
        value: BigInt(trade?.value?.quotient.toString() || '0'),
      });

      const result = await executeTransactions(
        smartAccountClient,
        transactions,
        'Send failed',
        fuse,
      );

      if (result === USER_CANCELLED_TRANSACTION) {
        return;
      }

      setSwapData(result);
      return result;
    } catch (error) {
      console.error('Voltage swap failed', error);
      Sentry.captureException(error, {
        tags: {
          type: 'voltage_swap_execution_failed',
          account,
        },
        extra: {
          inputAmount: trade?.inputAmount?.toSignificant(),
          outputAmount: trade?.outputAmount?.toSignificant(),
          allowedSlippage: allowedSlippage?.toSignificant(2),
          needAllowance,
          to: trade?.to,
          value: trade?.value?.quotient.toString(),
        },
      });
    } finally {
      setIsSendingSwap(false);
    }
  }, [trade, account, safeAA, user]);

  const { isLoading, isSuccess } = useTransactionAwait(swapData?.transactionHash, successInfo);

  return useMemo(() => {
    if (!trade)
      return {
        state: SwapCallbackState.INVALID,
        callback: null,
        error: 'No trade was found',
        isLoading: false,
        isSuccess: false,
        needAllowance,
      };

    return {
      state: SwapCallbackState.VALID,
      callback: swapCallback,
      error: null,
      isLoading: isSendingSwap || isLoading,
      isSuccess,
      needAllowance,
    };
  }, [trade, swapCallback, isLoading, isSuccess, isSendingSwap, needAllowance, approvalConfig]);
}
