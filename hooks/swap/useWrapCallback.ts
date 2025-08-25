import { Currency, tryParseAmount, WNATIVE } from '@cryptoalgebra/fuse-sdk';
import { useCallback, useMemo, useState } from 'react';
import { useBalance } from 'wagmi';

import { WNATIVE_EXTENDED } from '@/constants/routing';
import {
  useSimulateWrappedNativeDeposit,
  useSimulateWrappedNativeWithdraw,
} from '@/generated/wagmi';
import { executeTransactions, USER_CANCELLED_TRANSACTION } from '@/lib/execute';
import { Address, encodeFunctionData } from 'viem';
import { fuse } from 'viem/chains';
import { useTransactionAwait } from '../useTransactionAwait';
import useUser from '../useUser';

export enum WrapType {
  NOT_APPLICABLE = 'NOT_APPLICABLE',
  WRAP = 'WRAP',
  UNWRAP = 'UNWRAP',
}

const NOT_APPLICABLE = { wrapType: WrapType.NOT_APPLICABLE, isSuccess: false };

export default function useWrapCallback(
  inputCurrency: Currency | undefined,
  outputCurrency: Currency | undefined,
  typedValue: string | undefined,
): {
  wrapType: (typeof WrapType)[keyof typeof WrapType];
  execute?: undefined | (() => void);
  loading?: boolean;
  inputError?: string;
  isSuccess?: boolean;
} {
  const chainId = fuse.id;
  const { user, safeAA } = useUser();
  const account = user?.safeAddress;
  const [wrapData, setWrapData] = useState<any>(null);
  const [unwrapData, setUnwrapData] = useState<any>(null);
  const [isSendingWrap, setIsSendingWrap] = useState(false);
  const [isSendingUnwrap, setIsSendingUnwrap] = useState(false);
  const [capturedWrapSuccessInfo, setCapturedWrapSuccessInfo] = useState<any>(null);
  const [capturedUnwrapSuccessInfo, setCapturedUnwrapSuccessInfo] = useState<any>(null);

  const inputAmount = useMemo(
    () => tryParseAmount(typedValue, inputCurrency),
    [inputCurrency, typedValue],
  );

  const { data: wrapConfig } = useSimulateWrappedNativeDeposit({
    address: WNATIVE[chainId].address as Address,
    value: inputAmount ? BigInt(inputAmount.quotient.toString()) : undefined,
    chainId: fuse.id,
  });

  const wrapSuccessInfo = useMemo(() => {
    const successInfo = inputAmount && inputCurrency && outputCurrency ? {
      title: 'Wrap transaction completed',
      description: `${inputAmount.toSignificant()} ${inputCurrency.symbol} → ${outputCurrency.symbol}`,
      inputAmount: inputAmount.toSignificant(),
      inputSymbol: inputCurrency.symbol,
      outputSymbol: outputCurrency.symbol,
      chainId: 122,
    } : undefined;

    console.log('🔥 useWrapCallback - creating wrap success info', {
      hasInputAmount: !!inputAmount,
      hasInputCurrency: !!inputCurrency,
      hasOutputCurrency: !!outputCurrency,
      successInfo,
    });

    return successInfo;
  }, [inputAmount, inputCurrency, outputCurrency]);

  const { isLoading: isWrapLoading, isSuccess: isWrapSuccess } = useTransactionAwait(
    wrapData?.transactionHash,
    capturedWrapSuccessInfo
  );

  const { data: unwrapConfig } = useSimulateWrappedNativeWithdraw({
    address: WNATIVE[chainId].address as Address,
    args: inputAmount ? [BigInt(inputAmount.quotient.toString())] : undefined,
    chainId: fuse.id,
  });

  const unwrapSuccessInfo = useMemo(() => {
    const successInfo = inputAmount && inputCurrency && outputCurrency ? {
      title: 'Unwrap transaction completed',
      description: `${inputAmount.toSignificant()} ${inputCurrency.symbol} → ${outputCurrency.symbol}`,
      inputAmount: inputAmount.toSignificant(),
      inputSymbol: inputCurrency.symbol,
      outputSymbol: outputCurrency.symbol,
      chainId: 122,
    } : undefined;

    console.log('🔥 useWrapCallback - creating unwrap success info', {
      hasInputAmount: !!inputAmount,
      hasInputCurrency: !!inputCurrency,
      hasOutputCurrency: !!outputCurrency,
      successInfo,
    });

    return successInfo;
  }, [inputAmount, inputCurrency, outputCurrency]);

  const { isLoading: isUnwrapLoading, isSuccess: isUnwrapSuccess } = useTransactionAwait(
    unwrapData?.transactionHash,
    capturedUnwrapSuccessInfo
  );

  const wrap = useCallback(async () => {
    if (!wrapConfig || !user?.suborgId || !user?.signWith || !account) {
      return;
    }
    try {
      // Capture success info before form gets reset
      const currentSuccessInfo = wrapSuccessInfo;
      console.log('🔥 CAPTURING WRAP SUCCESS INFO BEFORE TRANSACTION', currentSuccessInfo);
      setCapturedWrapSuccessInfo(currentSuccessInfo);

      setIsSendingWrap(true);
      const smartAccountClient = await safeAA(fuse, user?.suborgId, user?.signWith);
      const transactions = [
        {
          to: wrapConfig?.request.address,
          data: encodeFunctionData({
            abi: wrapConfig!.request.abi,
            functionName: wrapConfig!.request.functionName,
            args: wrapConfig?.request.args,
          }),
          value: wrapConfig?.request.value,
        },
      ];
      const result = await executeTransactions(
        smartAccountClient,
        transactions,
        'Wrap failed',
        fuse,
      );

      if (result === USER_CANCELLED_TRANSACTION) {
        return;
      }

      setWrapData(result);
      return result;
    } finally {
      setIsSendingWrap(false);
    }
  }, [wrapConfig, user?.suborgId, user?.signWith, account, safeAA, wrapSuccessInfo]);

  const unwrap = useCallback(async () => {
    if (!unwrapConfig || !user?.suborgId || !user?.signWith || !account) {
      return;
    }
    try {
      // Capture success info before form gets reset
      const currentSuccessInfo = unwrapSuccessInfo;
      console.log('🔥 CAPTURING UNWRAP SUCCESS INFO BEFORE TRANSACTION', currentSuccessInfo);
      setCapturedUnwrapSuccessInfo(currentSuccessInfo);

      setIsSendingUnwrap(true);
      const smartAccountClient = await safeAA(fuse, user?.suborgId, user?.signWith);

      const transactions = [
        {
          to: unwrapConfig?.request.address,
          data: encodeFunctionData({
            abi: unwrapConfig!.request.abi,
            functionName: unwrapConfig!.request.functionName,
            args: unwrapConfig?.request.args,
          }),
          value: unwrapConfig?.request.value,
        },
      ];
      const result = await executeTransactions(
        smartAccountClient,
        transactions,
        'Unwrap failed',
        fuse,
      );

      if (result === USER_CANCELLED_TRANSACTION) {
        return;
      }

      setUnwrapData(result);
      return result;
    } finally {
      setIsSendingUnwrap(false);
    }
  }, [unwrapConfig, user?.suborgId, user?.signWith, account, safeAA, unwrapSuccessInfo]);

  const { data: balance } = useBalance({
    query: {
      enabled: Boolean(inputCurrency),
    },
    address: account,
    token: inputCurrency?.isNative ? undefined : (inputCurrency?.address as Address),
    chainId: fuse.id,
  });

  return useMemo(() => {
    if (!chainId || !inputCurrency || !outputCurrency) return NOT_APPLICABLE;
    const weth = WNATIVE_EXTENDED[chainId];
    if (!weth) return NOT_APPLICABLE;

    const hasInputAmount = Boolean(inputAmount?.greaterThan('0'));
    const sufficientBalance =
      inputAmount && balance && Number(balance.value) >= Number(inputAmount.toSignificant(18));

    if (inputCurrency.isNative && weth.equals(outputCurrency)) {
      return {
        wrapType: WrapType.WRAP,
        execute: sufficientBalance && inputAmount ? () => wrap?.() : undefined,
        loading: isSendingWrap || isWrapLoading,
        isSuccess: isWrapSuccess,
        inputError: sufficientBalance
          ? undefined
          : hasInputAmount
            ? `Insufficient FUSE balance`
            : `Enter FUSE amount`,
      };
    } else if (weth.equals(inputCurrency) && outputCurrency.isNative) {
      return {
        wrapType: WrapType.UNWRAP,
        execute: sufficientBalance && inputAmount ? () => unwrap?.() : undefined,
        loading: isSendingUnwrap || isUnwrapLoading,
        isSuccess: isUnwrapSuccess,
        inputError: sufficientBalance
          ? undefined
          : hasInputAmount
            ? `Insufficient WFUSE balance`
            : `Enter WFUSE amount`,
      };
    } else {
      return NOT_APPLICABLE;
    }
  }, [
    chainId,
    inputCurrency,
    outputCurrency,
    inputAmount,
    balance,
    wrap,
    unwrap,
    wrapConfig,
    unwrapConfig,
    isWrapLoading,
    isUnwrapLoading,
    isSendingWrap,
    isSendingUnwrap,
  ]);
}
