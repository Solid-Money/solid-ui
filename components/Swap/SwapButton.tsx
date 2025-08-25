import React, { useCallback, useMemo } from 'react';
import Toast from 'react-native-toast-message';

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
import { fuse } from 'viem/chains';

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
        console.log('🔥 SWAP SUCCESS HANDLER CALLED', {
          inputSymbol,
          outputSymbol,
          inputAmount,
        });

        setTransaction({
          amount: Number(inputAmount),
          address: currencies[SwapField.INPUT]?.wrapped.address,
          inputCurrencySymbol: inputSymbol,
          outputCurrencySymbol: outputSymbol,
        });

        console.log('🔥 SETTING MODAL TO TRANSACTION STATUS');
        setModal(SWAP_MODAL.OPEN_TRANSACTION_STATUS);
        resetForm();
      },
    [setTransaction, setModal, resetForm, currencies],
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
    [currencies, typedValue],
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
    chainId: fuse.id,
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
        // console.log('Creating batch swap success info:', successInfo);
        return successInfo;
      })()
      : (() => {
        // console.log('No success info created - missing currencies or trade:', {
        //   inputCurrency: !!currencies[SwapField.INPUT],
        //   outputCurrency: !!currencies[SwapField.OUTPUT],
        //   trade: !!trade,
        // });
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
    console.log('🔥 HANDLE SWAP CALLED', {
      isVoltageTrade,
      hasBatchVoltageSwapCallback: !!batchVoltageSwapCallback,
      hasBatchSwapCallback: !!batchSwapCallback,
    });

    try {
      if (isVoltageTrade) {
        if (!batchVoltageSwapCallback) {
          console.log('❌ No voltage swap callback available');
          return;
        }
        console.log('🔥 Calling voltage swap callback');
        await batchVoltageSwapCallback();
      } else {
        if (!batchSwapCallback) {
          console.log('❌ No batch swap callback available');
          return;
        }
        console.log('🔥 Calling batch swap callback');
        await batchSwapCallback();
      }
      console.log('✅ Swap transaction completed successfully');
    } catch (error) {
      console.error('❌ Swap transaction failed:', error);
      return new Error(`Swap Failed ${error}`);
    }
  }, [batchSwapCallback, batchVoltageSwapCallback, isVoltageTrade]);

  const handlePegSwap = useCallback(async () => {
    console.log('🔥 HANDLE PEG SWAP CALLED', {
      hasBatchPegSwapCallback: !!batchPegSwapCallback,
    });

    try {
      if (!batchPegSwapCallback) {
        console.log('❌ No peg swap callback available');
        return;
      }
      console.log('🔥 Calling peg swap callback');
      await batchPegSwapCallback();
      console.log('✅ Peg swap transaction completed successfully');
    } catch (error) {
      console.error('❌ Peg swap transaction failed:', error);
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

    const handlePegSwapWithLogging = () => {
      console.log('🔥 PEG SWAP BUTTON CLICKED!');
      handlePegSwap();
    };

    return (
      <Button
        className="rounded-xl"
        size="lg"
        onPress={handlePegSwapWithLogging}
        disabled={isPegSwapAnyLoading}
      >
        {isPegSwapAnyLoading ? (
          <Text className="font-semibold">Migrating...</Text>
        ) : needPegSwapAllowance ? (
          <Text className="font-semibold">Approve & Migrate</Text>
        ) : (
          <Text className="font-semibold">Migrate</Text>
        )}
      </Button>
    );
  }

  if (showWrap && wrapInputError) {
    return (
      <Button className="rounded-xl" size="lg" disabled>
        <Text className="font-semibold">{wrapInputError}</Text>
      </Button>
    );
  }

  if (showWrap) {
    const handleWrapWithLogging = async () => {
      console.log('🔥 WRAP BUTTON CLICKED!', { wrapType, hasOnWrap: !!onWrap });

      if (onWrap) {
        // Set transaction data in store similar to swap
        setTransaction({
          amount: Number(typedValue || '0'),
          address: currencies[SwapField.INPUT]?.wrapped.address,
          inputCurrencySymbol: currencies[SwapField.INPUT]?.symbol,
          outputCurrencySymbol: currencies[SwapField.OUTPUT]?.symbol,
        });

        // Execute the wrap/unwrap
        const result = await onWrap();

        if (result) {
          console.log('🔥 WRAP SUCCESS - SETTING MODAL TO TRANSACTION STATUS');
          // Open transaction status modal
          setModal(SWAP_MODAL.OPEN_TRANSACTION_STATUS);
          resetForm();
        }
      }
    };

    return (
      <Button className="rounded-xl" size="lg" onPress={handleWrapWithLogging}>
        {isWrapLoading ? (
          <Text className="font-semibold">
            {wrapType === WrapType.WRAP ? 'Wrapping...' : 'Unwrapping...'}
          </Text>
        ) : wrapType === WrapType.WRAP ? (
          <Text className="font-semibold">Wrap</Text>
        ) : (
          <Text className="font-semibold">Unwrap</Text>
        )}
      </Button>
    );
  }

  if (routeNotFound && userHasSpecifiedInputOutput) {
    return (
      <Button className="rounded-xl" size="lg" disabled>
        {isLoadingRoute ? (
          <Text className="font-semibold">Finding Routes...</Text>
        ) : (
          <Text className="font-semibold">Insufficient liquidity for this trade.</Text>
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

  const isButtonDisabled =
    !isValid ||
    priceImpactTooHigh ||
    !!swapCallbackError ||
    isSwapLoading ||
    isVoltageTradeLoading ||
    (isVoltageTrade && (!!voltageSwapCallbackError || isVoltageSwapLoading)) ||
    isBatchSwapLoading ||
    isBatchVoltageSwapLoading;

  console.log('🔥 SWAP BUTTON STATE', {
    isValid,
    priceImpactTooHigh,
    swapCallbackError,
    isSwapLoading,
    isVoltageTradeLoading,
    isVoltageTrade,
    voltageSwapCallbackError,
    isVoltageSwapLoading,
    isBatchSwapLoading,
    isBatchVoltageSwapLoading,
    isButtonDisabled,
    isAnyLoading,
    showWrap,
    showPegSwap,
    routeNotFound,
    userHasSpecifiedInputOutput,
  });

  const handleSwapWithLogging = () => {
    console.log('🔥 SWAP BUTTON CLICKED!');
    handleSwap();
  };

  return (
    <Button
      className="rounded-xl"
      variant="brand"
      size="lg"
      onPress={handleSwapWithLogging}
      disabled={isButtonDisabled}
    >
      {isAnyLoading ? (
        <Text className="font-semibold">Processing Transaction...</Text>
      ) : swapInputError ? (
        <Text className="font-semibold">{swapInputError}</Text>
      ) : priceImpactTooHigh ? (
        <Text className="font-semibold">Price Impact Too High</Text>
      ) : priceImpactSeverity > 2 ? (
        <Text className="font-semibold">Swap Anyway</Text>
      ) : needsApproval ? (
        <Text className="font-semibold">Approve & Swap</Text>
      ) : (
        <Text className="font-semibold">Swap</Text>
      )}
    </Button>
  );
};

export default SwapButton;
