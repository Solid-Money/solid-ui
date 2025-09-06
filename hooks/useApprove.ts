import { Currency, CurrencyAmount, Percent, Trade, TradeType } from '@cryptoalgebra/fuse-sdk';
import { useCallback, useMemo, useState } from 'react';

import { ALGEBRA_ROUTER, PEG_SWAP } from '@/constants/addresses';
import { MarketData } from '@/constants/lend';
import { VoltageTrade } from '@/hooks/swap/useVoltageRouter';
import { useNeedAllowance } from '@/hooks/tokens/useNeedAllowance';
import { executeTransactions } from '@/lib/execute';
import { ApprovalState, ApprovalStateType } from '@/lib/types/approve-state';
import { computeSlippageAdjustedAmounts } from '@/lib/utils/swap/prices';
import { Address, encodeFunctionData, erc20Abi } from 'viem';
import { fuse } from 'viem/chains';
import { useSimulateContract } from 'wagmi';
import { useTransactionAwait } from './useTransactionAwait';
import useUser from './useUser';

export function useApprove(
  amountToApprove: CurrencyAmount<Currency> | undefined,
  spender: Address,
) {
  const { user, safeAA } = useUser();
  const account = user?.safeAddress;
  const token = amountToApprove?.currency?.isToken ? amountToApprove.currency : undefined;
  const needAllowance = useNeedAllowance(token, amountToApprove, spender);

  const approvalState: ApprovalStateType = useMemo(() => {
    if (!amountToApprove || !spender) return ApprovalState.UNKNOWN;
    if (amountToApprove.currency.isNative) return ApprovalState.APPROVED;

    return needAllowance ? ApprovalState.NOT_APPROVED : ApprovalState.APPROVED;
  }, [amountToApprove, needAllowance, spender]);

  const { data: config } = useSimulateContract({
    address: amountToApprove ? (amountToApprove.currency.wrapped.address as Address) : undefined,
    abi: erc20Abi,
    functionName: 'approve',
    args: [spender, amountToApprove ? BigInt(amountToApprove.quotient.toString()) : 0] as [
      Address,
      bigint,
    ],
  });

  const [approvalData, setApprovalData] = useState<any>(null);

  const approve = useCallback(async () => {
    if (!config || !user?.suborgId || !user?.signWith || !account) {
      return;
    }
    const smartAccountClient = await safeAA(fuse, user?.suborgId, user?.signWith);
    const transactions = [
      {
        to: config?.request.address,
        data: encodeFunctionData({
          abi: config!.request.abi,
          functionName: config!.request.functionName,
          args: config?.request.args,
        }),
      },
    ];
    const result = await executeTransactions(
      smartAccountClient,
      transactions,
      'Approve failed',
      fuse,
    );
    setApprovalData(result);
    return result;
  }, [config, user?.suborgId, user?.signWith, account, safeAA]);

  const { isLoading, isSuccess } = useTransactionAwait(approvalData?.transactionHash);

  return {
    approvalState: isLoading
      ? ApprovalState.PENDING
      : isSuccess && approvalState === ApprovalState.APPROVED
        ? ApprovalState.APPROVED
        : approvalState,
    approvalConfig: config,
    needAllowance,
    approvalCallback: approve,
  };
}

export function useApproveCallbackFromTrade(
  trade: Trade<Currency, Currency, TradeType> | undefined,
  allowedSlippage: Percent,
) {
  const amountToApprove = useMemo(
    () =>
      trade && trade.inputAmount.currency.isToken
        ? trade.maximumAmountIn(allowedSlippage)
        : undefined,
    [trade, allowedSlippage],
  );
  return useApprove(amountToApprove, ALGEBRA_ROUTER);
}

export function useApproveCallbackFromVoltageTrade(
  trade: VoltageTrade | undefined,
  allowedSlippage: Percent,
) {
  const amountToApprove = useMemo(
    () =>
      trade && trade.inputAmount?.currency.isToken
        ? computeSlippageAdjustedAmounts(trade, allowedSlippage).inputAmount
        : undefined,
    [trade, allowedSlippage],
  );
  return useApprove(amountToApprove, trade?.to as Address);
}

export function useApproveCallbackFromPegSwap(
  inputCurrencyAmount: CurrencyAmount<Currency> | undefined,
  pegSwapAddress: Address | undefined,
) {
  return useApprove(inputCurrencyAmount, pegSwapAddress || PEG_SWAP);
}

export function useApproveCallbackFromLendingPool(
  inputCurrencyAmount: CurrencyAmount<Currency> | undefined,
  lendingPoolAddress?: Address,
) {
  return useApprove(inputCurrencyAmount, lendingPoolAddress || MarketData.addresses.LENDING_POOL);
}
