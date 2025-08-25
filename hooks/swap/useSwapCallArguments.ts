import { useUserState } from '@/store/userStore';
import { Currency, Percent, SwapRouter, Trade, TradeType } from '@cryptoalgebra/fuse-sdk';
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

    return swapMethods.map(({ calldata, value }) => {
      return {
        calldata: Array.isArray(calldata) ? calldata[0] : calldata,
        value,
      };
    });
  }, [trade, account, txDeadline, allowedSlippage]);
}
