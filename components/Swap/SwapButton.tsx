import React, { useCallback, useMemo } from 'react';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { SWAP_MODAL } from '@/constants/modals';
import { useSimulatePegSwapSwap } from '@/generated/wagmi';
import usePegSwapCallback, { PegSwapType } from '@/hooks/swap/usePegswapCallback';
import { useSwapCallArguments } from '@/hooks/swap/useSwapCallArguments';
import { useSwapCallback } from '@/hooks/swap/useSwapCallback';
import { useVoltageSwapCallback } from '@/hooks/swap/useVoltageSwapCallback';
import useWrapCallback, { WrapType } from '@/hooks/swap/useWrapCallback';
import {
  useBatchApproveAndPegSwap,
  useBatchApproveAndSwap,
  useBatchApproveAndVoltageSwap,
} from '@/hooks/useApprove';
import { SwapField } from '@/lib/types/swap-field';
import { TradeState } from '@/lib/types/trade-state';
import { computeRealizedLPFeePercent, warningSeverity } from '@/lib/utils/swap/prices';
import { useDerivedSwapInfo, useSwapState } from '@/store/swapStore';
import { useUserState } from '@/store/userStore';
import { tryParseAmount } from '@cryptoalgebra/fuse-sdk';
import { encodeFunctionData } from 'viem';

const SwapButton: React.FC = () => {
  const { isExpertMode } = useUserState();

  const {
    independentField,
    typedValue,
    actions: { resetForm, setModal, setTransaction },
  } = useSwapState();
  const {
    tradeState,
    toggledTrade: trade,
    allowedSlippage,
    parsedAmount,
    currencies,
    inputError: swapInputError,
    isVoltageTradeLoading,
    isVoltageTrade,
    voltageTrade,
  } = useDerivedSwapInfo();

  const {
    wrapType,
    execute: onWrap,
    loading: isWrapLoading,
    inputError: wrapInputError,
  } = useWrapCallback(currencies[SwapField.INPUT], currencies[SwapField.OUTPUT], typedValue);

  const {
    pegSwapType,
    pegSwapAddress,
    // callback: onPegSwap,
    inputError: pegSwapInputError,
    isLoading: isPegSwapLoading,
  } = usePegSwapCallback(currencies[SwapField.INPUT], currencies[SwapField.OUTPUT], typedValue);

  const showWrap = wrapType !== WrapType.NOT_APPLICABLE;

  const showPegSwap = pegSwapType !== PegSwapType.NOT_APPLICABLE;

  // Create success handlers for different transaction types
  const createSwapSuccessHandler = useCallback(
    (inputSymbol: string, outputSymbol: string, inputAmount: string, _outputAmount?: string) =>
      () => {
        setTransaction({
          amount: Number(inputAmount),
          address: currencies[SwapField.INPUT]?.wrapped.address,
          inputCurrencySymbol: inputSymbol,
          outputCurrencySymbol: outputSymbol,
        });

        setModal(SWAP_MODAL.OPEN_TRANSACTION_STATUS);
        resetForm();
      },
    [setTransaction, setModal, resetForm],
  );

  const parsedAmountA = independentField === SwapField.INPUT ? parsedAmount : trade?.inputAmount;

  const parsedAmountB = independentField === SwapField.OUTPUT ? parsedAmount : trade?.outputAmount;

  const parsedAmounts = useMemo(
    () => ({
      [SwapField.INPUT]: parsedAmountA,
      [SwapField.OUTPUT]: parsedAmountB,
    }),
    [parsedAmountA, parsedAmountB],
  );

  const userHasSpecifiedInputOutput = Boolean(
    currencies[SwapField.INPUT] &&
    currencies[SwapField.OUTPUT] &&
    parsedAmounts[independentField]?.greaterThan('0'),
  );

  const routeNotFound = trade?.swaps.length === 0;
  const isLoadingRoute = TradeState.LOADING === tradeState.state;

  // Get swap call arguments for batch operations
  const swapCalldata = useSwapCallArguments(trade, allowedSlippage);
  const swapValue = useMemo(() => {
    if (!swapCalldata || swapCalldata.length === 0) return 0n;
    return BigInt(swapCalldata[0]?.value || 0);
  }, [swapCalldata]);

  // Get peg swap calldata for batch operations
  const inputAmount = useMemo(
    () => tryParseAmount(typedValue, currencies[SwapField.INPUT]),
    [currencies[SwapField.INPUT], typedValue],
  );
  const inputCurrencyAddress = currencies[SwapField.INPUT]?.isToken
    ? currencies[SwapField.INPUT]?.wrapped?.address
    : undefined;
  const outputCurrencyAddress = currencies[SwapField.OUTPUT]?.isToken
    ? currencies[SwapField.OUTPUT]?.wrapped?.address
    : undefined;

  const { data: pegSwapConfig } = useSimulatePegSwapSwap({
    address: pegSwapAddress,
    args:
      inputAmount && inputCurrencyAddress && outputCurrencyAddress
        ? [BigInt(inputAmount.quotient.toString()), inputCurrencyAddress, outputCurrencyAddress]
        : undefined,
  });

  const {
    batchCallback: batchSwapCallback,
    isLoading: isBatchSwapLoading,
    needAllowance: needSwapAllowance,
  } = useBatchApproveAndSwap(
    trade,
    allowedSlippage,
    swapCalldata?.[0]?.calldata,
    swapValue,
    currencies[SwapField.INPUT] && currencies[SwapField.OUTPUT] && trade
      ? (() => {
        const successInfo = {
          title: 'Swap transaction completed',
          description: `${trade.inputAmount.toSignificant()} ${currencies[SwapField.INPUT]?.symbol} → ${trade.outputAmount.toSignificant()} ${currencies[SwapField.OUTPUT]?.symbol}`,
          inputAmount: trade.inputAmount.toSignificant(),
          outputAmount: trade.outputAmount.toSignificant(),
          inputSymbol: currencies[SwapField.INPUT]?.symbol,
          outputSymbol: currencies[SwapField.OUTPUT]?.symbol,
          chainId: 122,
          onSuccess: createSwapSuccessHandler(
            currencies[SwapField.INPUT]?.symbol || '',
            currencies[SwapField.OUTPUT]?.symbol || '',
            trade.inputAmount.toSignificant(),
            trade.outputAmount.toSignificant(),
          ),
        };
        console.log('Creating batch swap success info:', successInfo);
        return successInfo;
      })()
      : (() => {
        console.log('No success info created - missing currencies or trade:', {
          inputCurrency: !!currencies[SwapField.INPUT],
          outputCurrency: !!currencies[SwapField.OUTPUT],
          trade: !!trade,
        });
        return undefined;
      })(),
  );

  const {
    batchCallback: batchVoltageSwapCallback,
    isLoading: isBatchVoltageSwapLoading,
    needAllowance: needVoltageSwapAllowance,
  } = useBatchApproveAndVoltageSwap(
    isVoltageTrade ? voltageTrade.trade : undefined,
    allowedSlippage,
    currencies[SwapField.INPUT] && currencies[SwapField.OUTPUT] && voltageTrade.trade
      ? {
        title: 'Voltage swap transaction completed',
        description: `${voltageTrade.trade.inputAmount?.toSignificant()} ${currencies[SwapField.INPUT]?.symbol} → ${voltageTrade.trade.outputAmount?.toSignificant()} ${currencies[SwapField.OUTPUT]?.symbol}`,
        inputAmount: voltageTrade.trade.inputAmount?.toSignificant(),
        outputAmount: voltageTrade.trade.outputAmount?.toSignificant(),
        inputSymbol: currencies[SwapField.INPUT]?.symbol,
        outputSymbol: currencies[SwapField.OUTPUT]?.symbol,
        chainId: 122,
        onSuccess: createSwapSuccessHandler(
          currencies[SwapField.INPUT]?.symbol || '',
          currencies[SwapField.OUTPUT]?.symbol || '',
          voltageTrade.trade.inputAmount?.toSignificant() || '',
          voltageTrade.trade.outputAmount?.toSignificant(),
        ),
      }
      : undefined,
  );

  const {
    batchCallback: batchPegSwapCallback,
    isLoading: isBatchPegSwapLoading,
    needAllowance: needPegSwapAllowance,
  } = useBatchApproveAndPegSwap(
    inputAmount,
    pegSwapAddress,
    pegSwapConfig?.request
      ? encodeFunctionData({
        abi: pegSwapConfig.request.abi,
        functionName: pegSwapConfig.request.functionName,
        args: pegSwapConfig.request.args,
      })
      : undefined,
    pegSwapConfig?.request?.value || 0n,
    currencies[SwapField.INPUT] && currencies[SwapField.OUTPUT] && inputAmount
      ? {
        title: 'Migration transaction completed',
        description: `${inputAmount.toSignificant()} ${currencies[SwapField.INPUT]?.symbol} → ${currencies[SwapField.OUTPUT]?.symbol}`,
        inputAmount: inputAmount.toSignificant(),
        inputSymbol: currencies[SwapField.INPUT]?.symbol,
        outputSymbol: currencies[SwapField.OUTPUT]?.symbol,
        chainId: 122,
        onSuccess: createSwapSuccessHandler(
          currencies[SwapField.INPUT]?.symbol || '',
          currencies[SwapField.OUTPUT]?.symbol || '',
          inputAmount.toSignificant(),
        ),
      }
      : undefined,
  );

  const priceImpactSeverity = useMemo(() => {
    if (!trade) return 4;
    const realizedLpFeePercent = computeRealizedLPFeePercent(trade);
    const priceImpact = isVoltageTrade
      ? voltageTrade?.trade?.priceImpact?.subtract(realizedLpFeePercent)
      : trade?.priceImpact?.subtract(realizedLpFeePercent);
    return warningSeverity(priceImpact);
  }, [trade, isVoltageTrade, voltageTrade]);

  const needsApproval = useMemo(() => {
    if (showPegSwap) return needPegSwapAllowance;
    return isVoltageTrade ? needVoltageSwapAllowance : needSwapAllowance;
  }, [
    showPegSwap,
    needPegSwapAllowance,
    isVoltageTrade,
    needVoltageSwapAllowance,
    needSwapAllowance,
  ]);

  const {
    // callback: swapCallback,
    error: swapCallbackError,
    isLoading: isSwapLoading,
  } = useSwapCallback(
    trade,
    allowedSlippage,
    // approvalState
  );

  const { error: voltageSwapCallbackError, isLoading: isVoltageSwapLoading } =
    useVoltageSwapCallback(
      isVoltageTrade ? voltageTrade.trade : undefined,
      // voltageApprovalState
    );

  const handleSwap = useCallback(async () => {
    try {
      if (isVoltageTrade) {
        if (!batchVoltageSwapCallback) return;
        await batchVoltageSwapCallback();
      } else {
        if (!batchSwapCallback) return;
        await batchSwapCallback();
      }
    } catch (error) {
      return new Error(`Swap Failed ${error}`);
    }
  }, [batchSwapCallback, batchVoltageSwapCallback]);

  const handlePegSwap = useCallback(async () => {
    try {
      if (!batchPegSwapCallback) return;
      await batchPegSwapCallback();
    } catch (error) {
      return new Error(`Peg Swap Failed ${error}`);
    }
  }, [batchPegSwapCallback]);

  const isValid = !swapInputError;

  const priceImpactTooHigh = priceImpactSeverity > 3 && !isExpertMode;

  if (showPegSwap && pegSwapInputError) {
    return (
      <Button className="mx-6" disabled>
        {pegSwapInputError}
      </Button>
    );
  }

  if (showPegSwap) {
    const isPegSwapAnyLoading = isBatchPegSwapLoading || isPegSwapLoading;
    return (
      <Button
        className="mx-[30px] rounded-[15px]"
        size="lg"
        onPress={handlePegSwap}
        disabled={isPegSwapAnyLoading}
      >
        {isPegSwapAnyLoading ? (
          <Text>Migrating...</Text>
        ) : needPegSwapAllowance ? (
          <Text>Approve & Migrate</Text>
        ) : (
          <Text>Migrate</Text>
        )}
      </Button>
    );
  }

  if (showWrap && wrapInputError) {
    return (
      <Button className="mx-[30px] rounded-[15px]" size="lg" disabled>
        <Text>{wrapInputError}</Text>
      </Button>
    );
  }

  if (showWrap) {
    return (
      <Button className="mx-[30px] rounded-[15px]" size="lg" onPress={() => onWrap && onWrap()}>
        {isWrapLoading ? (
          <Text>{wrapType === WrapType.WRAP ? 'Wrapping...' : 'Unwrapping...'}</Text>
        ) : wrapType === WrapType.WRAP ? (
          <Text>Wrap</Text>
        ) : (
          <Text>Unwrap</Text>
        )}
      </Button>
    );
  }

  if (routeNotFound && userHasSpecifiedInputOutput) {
    return (
      <Button className="mx-[30px] rounded-[15px]" size="lg" disabled>
        {isLoadingRoute ? (
          <Text>Finding Routes...</Text>
        ) : (
          <Text>Insufficient liquidity for this trade.</Text>
        )}
      </Button>
    );
  }

  const isAnyLoading =
    isSwapLoading ||
    isVoltageSwapLoading ||
    isWrapLoading ||
    isPegSwapLoading ||
    isBatchSwapLoading ||
    isBatchVoltageSwapLoading;

  return (
    <Button
      className="mx-[30px] rounded-[15px]"
      size="lg"
      onPress={handleSwap}
      disabled={
        !isValid ||
        priceImpactTooHigh ||
        !!swapCallbackError ||
        isSwapLoading ||
        isVoltageTradeLoading ||
        (isVoltageTrade && (!!voltageSwapCallbackError || isVoltageSwapLoading)) ||
        isBatchSwapLoading ||
        isBatchVoltageSwapLoading
      }
    >
      {isAnyLoading ? (
        <Text>Processing Transaction...</Text>
      ) : swapInputError ? (
        <Text>{swapInputError}</Text>
      ) : priceImpactTooHigh ? (
        <Text>Price Impact Too High</Text>
      ) : priceImpactSeverity > 2 ? (
        <Text>Swap Anyway</Text>
      ) : needsApproval ? (
        <Text>Approve & Swap</Text>
      ) : (
        <Text>Swap</Text>
      )}
    </Button>
  );
};

export default SwapButton;
