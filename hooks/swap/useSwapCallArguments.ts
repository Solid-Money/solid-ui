import { useUserState } from '@/store/userStore';
import { Currency, Percent, SwapRouter, Trade, TradeType } from '@cryptoalgebra/fuse-sdk';
import * as Sentry from '@sentry/react-native';
import { useMemo } from 'react';
import useUser from '../useUser';

export function useSwapCallArguments(
  trade: Trade<Currency, Currency, TradeType> | undefined,
  allowedSlippage: Percent,
) {
  const { user } = useUser();
  const account = user?.safeAddress;

  const { txDeadline } = useUserState();

  return useMemo(() => {
    if (!trade || !account) return [];

    try {
      const swapMethods: any[] = [];

      swapMethods.push(
        SwapRouter.swapCallParameters(trade, {
          feeOnTransfer: false,
          recipient: account,
          slippageTolerance: allowedSlippage,
          deadline: Date.now() + txDeadline * 1000,
        }),
      );

      if (trade.tradeType === TradeType.EXACT_INPUT) {
        swapMethods.push(
          SwapRouter.swapCallParameters(trade, {
            feeOnTransfer: true,
            recipient: account,
            slippageTolerance: allowedSlippage,
            deadline: Date.now() + txDeadline * 1000,
          }),
        );
      }

      Sentry.addBreadcrumb({
        message: 'Swap call arguments generated',
        category: 'swap',
        level: 'debug',
        data: {
          tradeType: trade.tradeType === TradeType.EXACT_INPUT ? 'EXACT_INPUT' : 'EXACT_OUTPUT',
          inputAmount: trade.inputAmount?.toSignificant(),
          outputAmount: trade.outputAmount?.toSignificant(),
          slippage: allowedSlippage.toSignificant(2),
          methodsCount: swapMethods.length,
          deadline: txDeadline,
        },
      });

      return swapMethods.map(({ calldata, value }) => {
        return {
          calldata,
          value,
        };
      });
    } catch (error) {
      console.error('Failed to generate swap call arguments:', error);
      Sentry.captureException(error, {
        tags: {
          type: 'swap_call_arguments_error',
          account,
        },
        extra: {
          trade: trade ? {
            inputAmount: trade.inputAmount?.toSignificant(),
            outputAmount: trade.outputAmount?.toSignificant(),
            tradeType: trade.tradeType,
          } : undefined,
          allowedSlippage: allowedSlippage?.toSignificant(2),
          txDeadline,
        },
      });
      return [];
    }
  }, [trade, account, txDeadline, allowedSlippage]);
}
