import { Currency, Token, tryParseAmount } from '@cryptoalgebra/fuse-sdk';
import JSBI from 'jsbi';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useBalance } from 'wagmi';

import {
  BNB,
  BNB_V2,
  BUSD,
  BUSD_USDT_V2_PEGSWAP,
  FUSD_DEPRECATED,
  FUSD_MIGRATION_PEGSWAP,
  FUSD_V2,
  LAYER_ZERO_PEGSWAP,
  PEG_SWAP,
  USDC_SOLANA,
  USDC_V2,
  USDT,
  USDT_V2,
  WETH,
  WETH_V2
} from '@/constants/addresses';
import { useReadPegSwapGetSwappableAmount, useSimulatePegSwapSwap } from '@/generated/wagmi';
import { executeTransactions, USER_CANCELLED_TRANSACTION } from '@/lib/execute';
import { ApprovalState } from '@/lib/types/approve-state';
import { Address, encodeFunctionData, formatUnits } from 'viem';
import { fuse } from 'viem/chains';
import { useApproveCallbackFromPegSwap } from '../useApprove';
import { TransactionSuccessInfo, useTransactionAwait } from '../useTransactionAwait';
import useUser from '../useUser';

export enum PegSwapType {
  SWAP = 'SWAP',
  NOT_APPLICABLE = 'NOT_APPLICABLE',
}

const NOT_APPLICABLE = { pegSwapType: PegSwapType.NOT_APPLICABLE };

function usePegLiquidity(
  pegSwapAddress?: string,
  inputCurrency?: Currency,
  outputCurrency?: Currency,
) {
  const address = pegSwapAddress as Address;
  const source = (inputCurrency as Token)?.address as Address;
  const target = (outputCurrency as Token)?.address as Address;

  const { data: liquidity } = useReadPegSwapGetSwappableAmount({
    address,
    args: [source, target],
    chainId: fuse.id,
    query: {
      enabled: Boolean(address && source && target),
    },
  });

  return useMemo(() => {
    if (!liquidity || outputCurrency?.decimals === undefined) {
      return undefined;
    }

    return formatUnits(liquidity, outputCurrency.decimals);
  }, [liquidity, outputCurrency?.decimals]);
}

function usePegMinimum(inputCurrency: Currency | undefined, outputCurrency: Currency | undefined) {
  if (!inputCurrency || !outputCurrency) return;

  const inputDecimals = inputCurrency.decimals;
  const outputDecimals = outputCurrency.decimals;
  const rate = JSBI.BigInt(Math.abs(inputDecimals - outputDecimals));
  const min = String(JSBI.exponentiate(JSBI.BigInt(10), rate));

  if (inputDecimals > outputDecimals) {
    return formatUnits(BigInt(min), inputDecimals);
  }

  return;
}

function isSwapPair(
  inputAddress: Address | undefined,
  outputAddress: Address | undefined,
  addressA: Address | undefined,
  addressB: Address | undefined,
): boolean {
  if (!inputAddress || !outputAddress || !addressA || !addressB) return false;
  return (
    (inputAddress.toLowerCase() === addressA.toLowerCase() &&
      outputAddress.toLowerCase() === addressB.toLowerCase()) ||
    (inputAddress.toLowerCase() === addressB.toLowerCase() &&
      outputAddress.toLowerCase() === addressA.toLowerCase())
  );
}

function usePegSwapAddress(
  inputCurrencyAddress: Address | undefined,
  outputCurrencyAddress: Address | undefined,
) {
  return useMemo(() => {
    if (!inputCurrencyAddress || !outputCurrencyAddress) return;

    const swapPairs = [
      // PEGSWAP
      { addresses: [FUSD_DEPRECATED, USDC_SOLANA], pegSwap: PEG_SWAP },

      // BUSD USDT V2 PEGSWAP
      { addresses: [BUSD, USDT_V2], pegSwap: BUSD_USDT_V2_PEGSWAP },

      // FUSD MIGRATION
      { addresses: [FUSD_DEPRECATED, FUSD_V2], pegSwap: FUSD_MIGRATION_PEGSWAP },

      // LAYER ZERO PEGSWAP
      { addresses: [BNB, BNB_V2], pegSwap: LAYER_ZERO_PEGSWAP },
      { addresses: [USDT, USDT_V2], pegSwap: LAYER_ZERO_PEGSWAP },
      { addresses: [WETH, WETH_V2], pegSwap: LAYER_ZERO_PEGSWAP },
      { addresses: [WETH_V2, WETH], pegSwap: LAYER_ZERO_PEGSWAP },
      { addresses: [USDC_SOLANA, USDC_V2], pegSwap: LAYER_ZERO_PEGSWAP },
    ];

    for (const { addresses, pegSwap } of swapPairs) {
      if (isSwapPair(inputCurrencyAddress, outputCurrencyAddress, addresses[0], addresses[1])) {
        return pegSwap;
      }
    }

    return;
  }, [inputCurrencyAddress, outputCurrencyAddress]);
}

export default function usePegSwapCallback(
  inputCurrency: Currency | undefined,
  outputCurrency: Currency | undefined,
  typedValue: string | undefined,
  successInfo?: TransactionSuccessInfo,
): {
  pegSwapType: PegSwapType;
  pegSwapAddress?: Address;
  callback?: undefined | (() => void);
  needAllowance?: boolean;
  inputError?: string;
  isLoading?: boolean;
  isSuccess?: boolean;
} {
  const { user, safeAA } = useUser();
  const account = user?.safeAddress;
  const [swapData, setSwapData] = useState<any>(null);
  const [isSendingSwap, setIsSendingSwap] = useState(false);

  const inputCurrencyAddress =
    inputCurrency instanceof Token ? (inputCurrency.address as Address) : undefined;
  const outputCurrencyAddress =
    outputCurrency instanceof Token ? (outputCurrency.address as Address) : undefined;

  const pegSwapAddress = usePegSwapAddress(inputCurrencyAddress, outputCurrencyAddress);
  const liquidity = usePegLiquidity(pegSwapAddress, inputCurrency, outputCurrency);

  const minimum = usePegMinimum(inputCurrency, outputCurrency);
  const inputAmount = useMemo(
    () => tryParseAmount(typedValue, inputCurrency),
    [inputCurrency, typedValue],
  );

  const { approvalState, needAllowance, approvalConfig } = useApproveCallbackFromPegSwap(inputAmount, pegSwapAddress);

  const { data: swapConfig, refetch: refetchSwapConfig } = useSimulatePegSwapSwap({
    address: pegSwapAddress,
    args:
      inputAmount && inputCurrencyAddress && outputCurrencyAddress
        ? [BigInt(inputAmount.quotient.toString()), inputCurrencyAddress, outputCurrencyAddress]
        : undefined,
    chainId: fuse.id,
  });

  useEffect(() => {
    if (approvalState === ApprovalState.APPROVED) {
      refetchSwapConfig();
    }
  }, [approvalState, refetchSwapConfig]);

  const swapCallback = useCallback(async () => {
    if (!account || !swapConfig?.request) {
      return;
    }

    try {
      setIsSendingSwap(true);
      const smartAccountClient = await safeAA(fuse, user?.suborgId, user?.signWith);

      const transactions = [];

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

      transactions.push({
        to: swapConfig?.request.address,
        data: encodeFunctionData({
          abi: swapConfig!.request.abi,
          functionName: swapConfig!.request.functionName,
          args: swapConfig!.request.args,
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
      console.error('Peg swap failed', error);
    } finally {
      setIsSendingSwap(false);
    }
  }, [swapConfig, user?.suborgId, user?.signWith, account, safeAA]);

  const { isLoading, isSuccess } = useTransactionAwait(swapData?.transactionHash, successInfo);

  const { data: inputCurrencyBalance } = useBalance({
    address: account,
    token: inputCurrencyAddress,
    query: {
      enabled: true,
    },
  });

  return useMemo(() => {
    if (!inputCurrency || !outputCurrency || !pegSwapAddress) return NOT_APPLICABLE;

    let error;
    if (
      inputAmount &&
      inputCurrencyBalance &&
      BigInt(inputCurrencyBalance.value) < BigInt(inputAmount.quotient.toString())
    ) {
      error = `Insufficient ${inputCurrency.symbol} balance`;
    } else if (Number(typedValue) > Number(liquidity)) {
      error = `Insufficient liquidity`;
    } else if (minimum && Number(typedValue) < Number(minimum)) {
      error = `Below minimum limit ${minimum}`;
    }

    return {
      pegSwapType: PegSwapType.SWAP,
      needAllowance,
      pegSwapAddress,
      callback: swapCallback,
      inputError: error,
      isLoading: isSendingSwap || isLoading,
      isSuccess,
    };
  }, [
    inputCurrency,
    outputCurrency,
    needAllowance,
    pegSwapAddress,
    inputAmount,
    inputCurrencyBalance,
    typedValue,
    liquidity,
    minimum,
    swapCallback,
    isLoading,
    isSuccess,
    isSendingSwap,
  ]);
}
