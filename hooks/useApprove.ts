import { Currency, CurrencyAmount, Percent, Trade, TradeType } from '@cryptoalgebra/fuse-sdk';
import { useCallback, useMemo, useState } from 'react';

import { ALGEBRA_ROUTER, PEG_SWAP } from '@/constants/addresses';
import { MarketData } from '@/constants/lend';
import { VoltageTrade } from '@/hooks/swap/useVoltageRouter';
import { useNeedAllowance } from '@/hooks/tokens/useNeedAllowance';
import { executeTransactions } from '@/lib/execute';
import { track } from '@/lib/firebase';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
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

  const { data: config, error: simulationError } = useSimulateContract({
    address: amountToApprove ? (amountToApprove.currency.wrapped.address as Address) : undefined,
    abi: erc20Abi,
    functionName: 'approve',
    chainId: fuse.id,
    args: [spender, amountToApprove ? BigInt(amountToApprove.quotient.toString()) : 0] as [
      Address,
      bigint,
    ],
    query: {
      enabled: Boolean(
        amountToApprove && 
        spender && 
        spender !== '0x0000000000000000000000000000000000000000' &&
        account && 
        amountToApprove.greaterThan(0) && 
        !amountToApprove.currency.isNative &&
        needAllowance
      ),
    },
  });

  // Log simulation errors for debugging
  if (simulationError && needAllowance && amountToApprove && spender) {
    console.error('🚨 Approval simulation failed:', {
      error: simulationError.message,
      token: amountToApprove.currency.wrapped.address,
      spender,
      amount: amountToApprove.toSignificant(),
      account,
    });
  }

  // Create fallback config if simulation fails but we need approval
  const fallbackConfig = useMemo(() => {
    if (config || !needAllowance || !amountToApprove || !spender || amountToApprove.currency.isNative) {
      return null;
    }
    
    
    return {
      request: {
        address: amountToApprove.currency.wrapped.address as Address,
        abi: erc20Abi,
        functionName: 'approve' as const,
        args: [spender, BigInt(amountToApprove.quotient.toString())] as [Address, bigint],
      }
    };
  }, [config, needAllowance, amountToApprove, spender]);

  const [approvalData, setApprovalData] = useState<any>(null);

  const approve = useCallback(async () => {
    const finalConfig = config || fallbackConfig;
    if (!finalConfig || !user?.suborgId || !user?.signWith || !account) {
      track(TRACKING_EVENTS.APPROVE_ERROR, {
        token_address: amountToApprove?.currency?.wrapped?.address,
        spender: spender,
        amount: amountToApprove?.toSignificant(),
        error: 'Missing configuration or user',
        source: 'useApprove',
      });
      return;
    }

    try {
      track(TRACKING_EVENTS.APPROVE_INITIATED, {
        token_address: amountToApprove?.currency?.wrapped?.address,
        spender: spender,
        amount: amountToApprove?.toSignificant(),
        chain_id: fuse.id,
        source: 'useApprove',
      });

      const smartAccountClient = await safeAA(fuse, user?.suborgId, user?.signWith);
      const transactions = [
        {
          to: finalConfig.request.address,
          data: encodeFunctionData({
            abi: finalConfig.request.abi,
            functionName: finalConfig.request.functionName,
            args: finalConfig.request.args,
          }),
        },
      ];
      const result = await executeTransactions(
        smartAccountClient,
        transactions,
        'Approve failed',
        fuse,
      );

      track(TRACKING_EVENTS.APPROVE_COMPLETED, {
        token_address: amountToApprove?.currency?.wrapped?.address,
        spender: spender,
        amount: amountToApprove?.toSignificant(),
        transaction_hash: result.transactionHash,
        source: 'useApprove',
      });

      setApprovalData(result);
      return result;
    } catch (error) {
      track(TRACKING_EVENTS.APPROVE_ERROR, {
        token_address: amountToApprove?.currency?.wrapped?.address,
        spender: spender,
        amount: amountToApprove?.toSignificant(),
        error: error instanceof Error ? error.message : 'Unknown error',
        user_cancelled: String(error).includes('cancelled'),
        source: 'useApprove',
      });
      throw error;
    }
  }, [config, fallbackConfig, user?.suborgId, user?.signWith, account, safeAA, amountToApprove, spender]);

  const { isLoading, isSuccess } = useTransactionAwait(approvalData?.transactionHash);

  const finalConfig = config || fallbackConfig;

  return {
    approvalState: isLoading
      ? ApprovalState.PENDING
      : isSuccess && approvalState === ApprovalState.APPROVED
        ? ApprovalState.APPROVED
        : approvalState,
    approvalConfig: finalConfig,
    needAllowance,
    approvalCallback: approve,
  };
}

export function useApproveCallbackFromTrade(
  trade: Trade<Currency, Currency, TradeType> | undefined,
  allowedSlippage: Percent,
  customSpender?: Address,
) {
  const amountToApprove = useMemo(
    () =>
      trade && trade.inputAmount.currency.isToken
        ? trade.maximumAmountIn(allowedSlippage)
        : undefined,
    [trade, allowedSlippage],
  );

  // Use custom spender if provided, otherwise default to ALGEBRA_ROUTER
  const spender = customSpender || ALGEBRA_ROUTER;

  const { approvalState, approvalConfig, needAllowance, approvalCallback } = useApprove(amountToApprove, spender);

  // Force needAllowance to true for token inputs when no approval config is generated
  // This ensures we always generate approval configs for token inputs
  const actualNeedAllowance = trade?.inputAmount.currency.isToken ?
    (needAllowance || !approvalConfig) : needAllowance;

  return {
    approvalState,
    approvalConfig,
    needAllowance: actualNeedAllowance,
    approvalCallback,
  };
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
  // Use allowanceTarget from Voltage API, which is the contract that needs approval
  // This is different from 'to' which is the transaction target
  // Fallback to a zero address if neither is available (this will disable the hook)
  const spender = (trade?.allowanceTarget || trade?.to || '0x0000000000000000000000000000000000000000') as Address;
  return useApprove(amountToApprove, spender);
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
