import * as Sentry from '@sentry/react-native';
import { useCallback, useMemo, useState } from 'react';

import { useActivity } from '@/hooks/useActivity';
import { executeTransactions, USER_CANCELLED_TRANSACTION } from '@/lib/execute';
import { TransactionType } from '@/lib/types';
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
  const { trackTransaction } = useActivity();
  const { needAllowance, approvalConfig } =
    useApproveCallbackFromVoltageTrade(trade, allowedSlippage);
    
  // For token inputs, check if we need approval
  const isTokenInput = trade?.inputAmount?.currency?.isToken;
  
  const account = user?.safeAddress;
  const [swapData, setSwapData] = useState<any>(null);
  const [isSendingSwap, setIsSendingSwap] = useState(false);


  const swapCallback = useCallback(async () => {
    if (!trade || !account || !user?.suborgId || !user?.signWith) return;

    try {
      setIsSendingSwap(true);
      const smartAccountClient = await safeAA(fuse, user.suborgId, user.signWith);

      const transactions: Array<{ to: Address; data: `0x${string}`; value?: bigint }> = [];


      if (needAllowance && approvalConfig) {

        Sentry.addBreadcrumb({
          message: 'Adding Voltage approval transaction',
          category: 'swap',
          level: 'debug',
          data: {
            tokenAddress: approvalConfig.request.address,
            needAllowance,
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

      const result = await trackTransaction(
        {
          type: TransactionType.SWAP,
          title: `Swap ${trade?.inputAmount?.toSignificant()} ${trade?.inputAmount?.currency?.symbol} to ${trade?.outputAmount?.toSignificant()} ${trade?.outputAmount?.currency?.symbol}`,
          shortTitle: `${trade?.inputAmount?.currency?.symbol} → ${trade?.outputAmount?.currency?.symbol}`,
          amount: trade?.inputAmount?.toSignificant() || '0',
          symbol: trade?.inputAmount?.currency?.symbol || 'TOKEN',
          chainId: fuse.id,
          fromAddress: user.safeAddress,
          toAddress: trade?.to as string,
          metadata: {
            description: `Swap ${trade?.inputAmount?.currency?.symbol} to ${trade?.outputAmount?.currency?.symbol}`,
            slippage: allowedSlippage?.toSignificant(2),
            needsApproval: needAllowance,
            platform: 'voltage',
            inputToken: trade?.inputAmount?.currency?.symbol,
            outputToken: trade?.outputAmount?.currency?.symbol,
            inputAmount: trade?.inputAmount?.toSignificant(6),
            outputAmount: trade?.outputAmount?.toSignificant(6),
          },
        },
        (onUserOpHash) => executeTransactions(
          smartAccountClient,
          transactions,
          'Voltage swap failed',
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

      setSwapData(result);

      // Call success callback immediately after transaction completes
      // This ensures the success modal is shown even if useTransactionAwait has timing issues
      if (successInfo?.onSuccess) {
        successInfo.onSuccess();
      }

      return transaction;
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
  }, [trade, account, safeAA, user, allowedSlippage, needAllowance, approvalConfig, successInfo, trackTransaction]);

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
