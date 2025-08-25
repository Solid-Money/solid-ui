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
import { TransactionSuccessInfo, useTransactionAwait } from './useTransactionAwait';
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
    approvalCallback: approve,
  };
}

export function useBatchApproveAndSwap(
  trade: Trade<Currency, Currency, TradeType> | undefined,
  allowedSlippage: Percent,
  swapCalldata: string | undefined,
  swapValue = 0n,
  successInfo?: TransactionSuccessInfo,
) {
  const { user, safeAA } = useUser();
  const account = user?.safeAddress;

  const amountToApprove = useMemo(
    () =>
      trade && trade.inputAmount.currency.isToken
        ? trade.maximumAmountIn(allowedSlippage)
        : undefined,
    [trade, allowedSlippage],
  );

  const token = amountToApprove?.currency?.isToken ? amountToApprove.currency : undefined;
  const needAllowance = useNeedAllowance(token, amountToApprove, ALGEBRA_ROUTER);

  const { data: approveConfig } = useSimulateContract({
    address: amountToApprove ? (amountToApprove.currency.wrapped.address as Address) : undefined,
    abi: erc20Abi,
    functionName: 'approve',
    chainId: fuse.id,
    args: [ALGEBRA_ROUTER, amountToApprove ? BigInt(amountToApprove.quotient.toString()) : 0] as [
      Address,
      bigint,
    ],
  });

  const [batchData, setBatchData] = useState<any>(null);
  const [isSendingBatch, setIsSendingBatch] = useState(false);

  const batchCallback = useCallback(async () => {
    if (!user?.suborgId || !user?.signWith || !account || !swapCalldata) {
      return;
    }

    try {
      setIsSendingBatch(true);
      const smartAccountClient = await safeAA(fuse, user?.suborgId, user?.signWith);

      const transactions = [];

      // Add approve transaction if needed
      if (needAllowance && approveConfig) {
        transactions.push({
          to: approveConfig.request.address,
          data: encodeFunctionData({
            abi: approveConfig.request.abi,
            functionName: approveConfig.request.functionName,
            args: approveConfig.request.args,
          }),
        });
      }

      // Add swap transaction
      if (swapCalldata) {
        const calldata = typeof swapCalldata === 'string' ? swapCalldata : String(swapCalldata);

        transactions.push({
          to: ALGEBRA_ROUTER,
          data: calldata,
          value: swapValue,
        });
      }

      const result = await executeTransactions(
        smartAccountClient,
        transactions,
        'Batch approve and swap failed',
        fuse,
      );
      setBatchData(result);
      return result;
    } catch (error) {
      console.error('Batch approve and swap failed', error);
    } finally {
      setIsSendingBatch(false);
    }
  }, [
    user?.suborgId,
    user?.signWith,
    account,
    swapCalldata,
    swapValue,
    needAllowance,
    approveConfig,
    safeAA,
  ]);

  const { isLoading, isSuccess } = useTransactionAwait(batchData?.transactionHash, successInfo);

  return {
    batchCallback,
    isLoading: isSendingBatch || isLoading,
    isSuccess,
    needAllowance,
  };
}

export function useBatchApproveAndVoltageSwap(
  trade: VoltageTrade | undefined,
  allowedSlippage: Percent,
  successInfo?: TransactionSuccessInfo,
) {
  const { user, safeAA } = useUser();
  const account = user?.safeAddress;

  const amountToApprove = useMemo(
    () =>
      trade && trade.inputAmount?.currency.isToken
        ? computeSlippageAdjustedAmounts(trade, allowedSlippage).inputAmount
        : undefined,
    [trade, allowedSlippage],
  );

  const token = amountToApprove?.currency?.isToken ? amountToApprove.currency : undefined;
  const needAllowance = useNeedAllowance(token, amountToApprove, trade?.to as Address);

  const { data: approveConfig } = useSimulateContract({
    address: amountToApprove ? (amountToApprove.currency.wrapped.address as Address) : undefined,
    abi: erc20Abi,
    functionName: 'approve',
    chainId: fuse.id,
    args: [
      trade?.to as Address,
      amountToApprove ? BigInt(amountToApprove.quotient.toString()) : 0,
    ] as [Address, bigint],
  });

  const [batchData, setBatchData] = useState<any>(null);
  const [isSendingBatch, setIsSendingBatch] = useState(false);

  const batchCallback = useCallback(async () => {
    if (!trade || !user?.suborgId || !user?.signWith || !account) {
      return;
    }

    try {
      setIsSendingBatch(true);
      const smartAccountClient = await safeAA(fuse, user?.suborgId, user?.signWith);

      const transactions = [];

      // Add approve transaction if needed
      if (needAllowance && approveConfig) {
        transactions.push({
          to: approveConfig.request.address,
          data: encodeFunctionData({
            abi: approveConfig.request.abi,
            functionName: approveConfig.request.functionName,
            args: approveConfig.request.args,
          }),
        });
      }

      // Add voltage swap transaction
      transactions.push({
        to: trade.to as Address,
        data: trade.data as `0x${string}`,
        value: BigInt(trade.value?.quotient.toString() || '0'),
      });

      const result = await executeTransactions(
        smartAccountClient,
        transactions,
        'Batch approve and voltage swap failed',
        fuse,
      );
      setBatchData(result);
      return result;
    } catch (error) {
      console.error('Batch approve and voltage swap failed', error);
    } finally {
      setIsSendingBatch(false);
    }
  }, [trade, user?.suborgId, user?.signWith, account, needAllowance, approveConfig, safeAA]);

  const { isLoading, isSuccess } = useTransactionAwait(batchData?.transactionHash, successInfo);

  return {
    batchCallback,
    isLoading: isSendingBatch || isLoading,
    isSuccess,
    needAllowance,
  };
}

export function useBatchApproveAndPegSwap(
  inputCurrencyAmount: CurrencyAmount<Currency> | undefined,
  pegSwapAddress: Address | undefined,
  pegSwapCalldata: string | undefined,
  pegSwapValue = 0n,
  successInfo?: TransactionSuccessInfo,
) {
  const { user, safeAA } = useUser();
  const account = user?.safeAddress;

  const token = inputCurrencyAmount?.currency?.isToken ? inputCurrencyAmount.currency : undefined;
  const needAllowance = useNeedAllowance(token, inputCurrencyAmount, pegSwapAddress || PEG_SWAP);

  const { data: approveConfig } = useSimulateContract({
    address: inputCurrencyAmount
      ? (inputCurrencyAmount.currency.wrapped.address as Address)
      : undefined,
    abi: erc20Abi,
    functionName: 'approve',
    chainId: fuse.id,
    args: [
      pegSwapAddress || PEG_SWAP,
      inputCurrencyAmount ? BigInt(inputCurrencyAmount.quotient.toString()) : 0,
    ] as [Address, bigint],
  });

  const [batchData, setBatchData] = useState<any>(null);
  const [isSendingBatch, setIsSendingBatch] = useState(false);

  const batchCallback = useCallback(async () => {
    if (!user?.suborgId || !user?.signWith || !account || !pegSwapCalldata) {
      return;
    }

    try {
      setIsSendingBatch(true);
      const smartAccountClient = await safeAA(fuse, user?.suborgId, user?.signWith);

      const transactions = [];

      // Add approve transaction if needed
      if (needAllowance && approveConfig) {
        transactions.push({
          to: approveConfig.request.address,
          data: encodeFunctionData({
            abi: approveConfig.request.abi,
            functionName: approveConfig.request.functionName,
            args: approveConfig.request.args,
          }),
        });
      }

      // Add peg swap transaction
      if (pegSwapCalldata) {
        transactions.push({
          to: pegSwapAddress || PEG_SWAP,
          data: pegSwapCalldata,
          value: pegSwapValue,
        });
      }

      const result = await executeTransactions(
        smartAccountClient,
        transactions,
        'Batch approve and peg swap failed',
        fuse,
      );
      setBatchData(result);
      return result;
    } catch (error) {
      console.error('Batch approve and peg swap failed', error);
    } finally {
      setIsSendingBatch(false);
    }
  }, [
    user?.suborgId,
    user?.signWith,
    account,
    pegSwapCalldata,
    pegSwapValue,
    needAllowance,
    approveConfig,
    pegSwapAddress,
    safeAA,
  ]);

  const { isLoading, isSuccess } = useTransactionAwait(batchData?.transactionHash, successInfo);

  return {
    batchCallback,
    isLoading: isSendingBatch || isLoading,
    isSuccess,
    needAllowance,
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
