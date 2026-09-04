import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import { Image } from 'expo-image';
import { tryParseAmount } from '@cryptoalgebra/fuse-sdk';
import * as Sentry from '@sentry/react-native';
import { Address } from 'viem';
import { useShallow } from 'zustand/react/shallow';

import InfoError from '@/assets/images/info-error';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { SWAP_MODAL } from '@/constants/modals';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import usePegSwapCallback, { PegSwapType } from '@/hooks/swap/usePegswapCallback';
import { useSwapCallback } from '@/hooks/swap/useSwapCallback';
import { useVoltageSwapCallback } from '@/hooks/swap/useVoltageSwapCallback';
import useWrapCallback, { WrapType } from '@/hooks/swap/useWrapCallback';
import useUser from '@/hooks/useUser';
import { track } from '@/lib/analytics';
import { getAsset } from '@/lib/assets';
import { SwapField } from '@/lib/types/swap-field';
import { TradeState } from '@/lib/types/trade-state';
import { computeRealizedLPFeePercent, warningSeverity } from '@/lib/utils/swap/prices';
import { useDerivedSwapInfo, useSwapState } from '@/store/swapStore';
import { selectedRewardsUserId, useRewardsUpgradeStore } from '@/store/useRewardsUpgradeStore';
import { useUserState } from '@/store/userStore';

interface SwapButtonProps {
  label?: string;
  showSecurityIcon?: boolean;
  disabled?: boolean;
  onConfirmed?: () => void;
}

const SwapButton: React.FC<SwapButtonProps> = ({
  label = 'Swap',
  showSecurityIcon = true,
  disabled = false,
  onConfirmed,
}) => {
  const executing = useRef(false);
  const successHandled = useRef(false);
  const operationSession = useRef<number | undefined>(undefined);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionError, setSubmissionError] = useState<string>();
  const { isExpertMode } = useUserState();
  const { user } = useUser();

  const { independentField, typedValue, resetForm, setModal, setTransaction } = useSwapState(
    useShallow(state => ({
      independentField: state.independentField,
      typedValue: state.typedValue,
      resetForm: state.actions.resetForm,
      setModal: state.actions.setModal,
      setTransaction: state.actions.setTransaction,
    })),
  );
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

  const inputCurrencyId = currencies[SwapField.INPUT]?.wrapped.address;
  const outputCurrencyId = currencies[SwapField.OUTPUT]?.wrapped.address;
  useEffect(() => {
    setSubmissionError(undefined);
  }, [typedValue, inputCurrencyId, outputCurrencyId, user?.userId]);

  const {
    wrapType,
    execute: onWrap,
    loading: isWrapLoading,
    inputError: wrapInputError,
  } = useWrapCallback(currencies[SwapField.INPUT], currencies[SwapField.OUTPUT], typedValue);

  const showWrap = wrapType !== WrapType.NOT_APPLICABLE;

  // Create success handlers for different transaction types
  const createSwapSuccessHandler = useCallback(
    (inputSymbol: string, outputSymbol: string, inputAmount: string, _outputAmount?: string) =>
      () => {
        if (
          successHandled.current ||
          selectedRewardsUserId() !== user?.userId ||
          operationSession.current !== useRewardsUpgradeStore.getState().session
        )
          return;
        successHandled.current = true;
        if (onConfirmed) {
          onConfirmed();
          return;
        }
        setTransaction({
          amount: Number(inputAmount),
          address: currencies[SwapField.INPUT]?.wrapped.address as Address,
          inputCurrencySymbol: inputSymbol,
          outputCurrencySymbol: outputSymbol,
        });

        setModal(SWAP_MODAL.OPEN_TRANSACTION_STATUS);
        resetForm();
      },
    [setTransaction, setModal, resetForm, currencies, onConfirmed, user?.userId],
  );

  const selectedTrade = isVoltageTrade ? voltageTrade.trade : trade;
  const parsedAmountA =
    independentField === SwapField.INPUT ? parsedAmount : selectedTrade?.inputAmount;

  const parsedAmountB =
    independentField === SwapField.OUTPUT ? parsedAmount : selectedTrade?.outputAmount;

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

  const routeNotFound =
    !isVoltageTrade &&
    (tradeState.state === TradeState.NO_ROUTE_FOUND || trade?.swaps.length === 0);
  const isLoadingRoute =
    !isVoltageTrade &&
    (tradeState.state === TradeState.LOADING || tradeState.state === TradeState.SYNCING);

  // Get peg swap calldata for batch operations
  const inputAmount = useMemo(
    () => tryParseAmount(typedValue, currencies[SwapField.INPUT]),
    [currencies, typedValue],
  );

  const {
    callback: swapCallback,
    isLoading: isSwapLoading,
    needAllowance: needSwapAllowance,
    error: swapCallbackError,
  } = useSwapCallback(
    trade,
    allowedSlippage,
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
          return successInfo;
        })()
      : (() => {
          return undefined;
        })(),
  );

  const {
    callback: voltageSwapCallback,
    isLoading: isVoltageSwapLoading,
    needAllowance: needVoltageSwapAllowance,
    error: voltageSwapCallbackError,
  } = useVoltageSwapCallback(
    isVoltageTrade ? voltageTrade.trade : undefined,
    allowedSlippage,
    currencies[SwapField.INPUT] && currencies[SwapField.OUTPUT] && voltageTrade.trade
      ? {
          title: 'Swap transaction completed',
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

  const selectedSwapCallback = isVoltageTrade ? voltageSwapCallback : swapCallback;
  const selectedCallbackError = isVoltageTrade ? voltageSwapCallbackError : swapCallbackError;

  const {
    pegSwapType,
    callback: pegSwapCallback,
    needAllowance: needPegSwapAllowance,
    inputError: pegSwapInputError,
    isLoading: isPegSwapLoading,
  } = usePegSwapCallback(
    currencies[SwapField.INPUT],
    currencies[SwapField.OUTPUT],
    typedValue,
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
    if (!trade) return 0;
    const realizedLpFeePercent = computeRealizedLPFeePercent(trade);
    const priceImpact = isVoltageTrade
      ? voltageTrade?.trade?.priceImpact?.subtract(realizedLpFeePercent)
      : trade?.priceImpact?.subtract(realizedLpFeePercent);
    return warningSeverity(priceImpact);
  }, [trade, isVoltageTrade, voltageTrade]);

  const showPegSwap = pegSwapType !== PegSwapType.NOT_APPLICABLE;

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

  const handleSwap = useCallback(async () => {
    if (disabled || executing.current) return;
    if (!selectedSwapCallback) {
      setSubmissionError(selectedCallbackError || 'Unable to get a quote. Try another amount.');
      return;
    }
    executing.current = true;
    setIsSubmitting(true);
    setSubmissionError(undefined);
    successHandled.current = false;
    operationSession.current = useRewardsUpgradeStore.getState().session;
    try {
      track(TRACKING_EVENTS.SWAP_INITIATED, {
        user_id: user?.userId,
        safe_address: user?.safeAddress,
        trade_type: isVoltageTrade ? 'voltage' : 'standard',
        input_currency: currencies[SwapField.INPUT]?.symbol,
        output_currency: currencies[SwapField.OUTPUT]?.symbol,
        input_amount: trade?.inputAmount?.toSignificant(),
        output_amount: trade?.outputAmount?.toSignificant(),
        allowed_slippage: allowedSlippage?.toSignificant(2),
        price_impact_severity: priceImpactSeverity,
        needs_approval: needsApproval,
      });

      Sentry.addBreadcrumb({
        message: 'Swap initiated',
        category: 'swap',
        level: 'info',
        data: {
          isVoltageTrade,
          inputCurrency: currencies[SwapField.INPUT]?.symbol,
          outputCurrency: currencies[SwapField.OUTPUT]?.symbol,
          inputAmount: trade?.inputAmount?.toSignificant(),
          outputAmount: trade?.outputAmount?.toSignificant(),
          allowedSlippage: allowedSlippage?.toSignificant(2),
        },
      });

      const result = await selectedSwapCallback();
      if (!result) return;

      track(TRACKING_EVENTS.SWAP_COMPLETED, {
        user_id: user?.userId,
        safe_address: user?.safeAddress,
        trade_type: isVoltageTrade ? 'voltage' : 'standard',
        input_currency: currencies[SwapField.INPUT]?.symbol,
        output_currency: currencies[SwapField.OUTPUT]?.symbol,
        input_amount: trade?.inputAmount?.toSignificant(),
        output_amount: trade?.outputAmount?.toSignificant(),
      });
    } catch (error: any) {
      console.error('❌ Swap transaction failed:', error);

      track(TRACKING_EVENTS.SWAP_FAILED, {
        user_id: user?.userId,
        safe_address: user?.safeAddress,
        trade_type: isVoltageTrade ? 'voltage' : 'standard',
        input_currency: currencies[SwapField.INPUT]?.symbol,
        output_currency: currencies[SwapField.OUTPUT]?.symbol,
        input_amount: trade?.inputAmount?.toSignificant(),
        error: String(error),
      });

      Sentry.captureException(error, {
        tags: {
          type: 'swap_button_error',
          isVoltageTrade: String(isVoltageTrade),
        },
        extra: {
          inputCurrency: currencies[SwapField.INPUT]?.symbol,
          outputCurrency: currencies[SwapField.OUTPUT]?.symbol,
          inputAmount: trade?.inputAmount?.toSignificant(),
          outputAmount: trade?.outputAmount?.toSignificant(),
          priceImpactSeverity,
          needsApproval,
        },
      });
      if (
        selectedRewardsUserId() === user?.userId &&
        operationSession.current === useRewardsUpgradeStore.getState().session
      ) {
        setSubmissionError(
          error?.shortMessage || error?.message || 'Unable to complete the swap. Please try again.',
        );
      }
    } finally {
      executing.current = false;
      setIsSubmitting(false);
    }
  }, [
    selectedSwapCallback,
    selectedCallbackError,
    isVoltageTrade,
    currencies,
    trade,
    allowedSlippage,
    priceImpactSeverity,
    needsApproval,
    user?.userId,
    user?.safeAddress,
    disabled,
  ]);

  const handlePegSwap = useCallback(async () => {
    if (disabled || executing.current) return;
    executing.current = true;
    successHandled.current = false;
    operationSession.current = useRewardsUpgradeStore.getState().session;
    try {
      track(TRACKING_EVENTS.PEG_SWAP_INITIATED, {
        user_id: user?.userId,
        safe_address: user?.safeAddress,
        peg_swap_type: String(pegSwapType),
        input_currency: currencies[SwapField.INPUT]?.symbol,
        output_currency: currencies[SwapField.OUTPUT]?.symbol,
        input_amount: inputAmount?.toSignificant(),
        needs_approval: needPegSwapAllowance,
      });

      Sentry.addBreadcrumb({
        message: 'Peg swap initiated',
        category: 'swap',
        level: 'info',
        data: {
          pegSwapType,
          inputCurrency: currencies[SwapField.INPUT]?.symbol,
          outputCurrency: currencies[SwapField.OUTPUT]?.symbol,
          inputAmount: inputAmount?.toSignificant(),
        },
      });

      if (!pegSwapCallback) return;
      await pegSwapCallback();

      track(TRACKING_EVENTS.PEG_SWAP_COMPLETED, {
        peg_swap_type: String(pegSwapType),
        input_currency: currencies[SwapField.INPUT]?.symbol,
        output_currency: currencies[SwapField.OUTPUT]?.symbol,
        input_amount: inputAmount?.toSignificant(),
      });
    } catch (error: any) {
      console.error('❌ Peg swap transaction failed:', error);

      track(TRACKING_EVENTS.PEG_SWAP_FAILED, {
        peg_swap_type: String(pegSwapType),
        input_currency: currencies[SwapField.INPUT]?.symbol,
        output_currency: currencies[SwapField.OUTPUT]?.symbol,
        input_amount: inputAmount?.toSignificant(),
        error: String(error),
      });

      Sentry.captureException(error, {
        tags: {
          type: 'peg_swap_button_error',
          pegSwapType: String(pegSwapType),
        },
        extra: {
          inputCurrency: currencies[SwapField.INPUT]?.symbol,
          outputCurrency: currencies[SwapField.OUTPUT]?.symbol,
          inputAmount: inputAmount?.toSignificant(),
          needPegSwapAllowance,
        },
      });
      return new Error(`Peg Swap Failed ${error}`);
    } finally {
      executing.current = false;
    }
  }, [
    pegSwapCallback,
    pegSwapType,
    currencies,
    inputAmount,
    needPegSwapAllowance,
    user?.userId,
    user?.safeAddress,
    disabled,
  ]);

  const isValid = !swapInputError;

  const priceImpactTooHigh = priceImpactSeverity > 3 && !isExpertMode;

  if (showPegSwap) {
    return (
      <View>
        {pegSwapInputError && <ErrorMessage message={pegSwapInputError} />}
        <Button
          className="rounded-xl"
          size="lg"
          onPress={handlePegSwap}
          disabled={disabled || isPegSwapLoading || !!pegSwapInputError}
        >
          {isPegSwapLoading ? (
            <Text className="text-base font-semibold">Migrating...</Text>
          ) : needPegSwapAllowance ? (
            <Text className="text-base font-semibold">Approve & Migrate</Text>
          ) : (
            <Text className="text-base font-semibold">Migrate</Text>
          )}
        </Button>
      </View>
    );
  }

  if (showWrap && wrapInputError) {
    return (
      <View>
        <ErrorMessage message={wrapInputError} />
        <Button className="rounded-xl" size="lg" disabled>
          <Text className="text-base font-semibold">
            {wrapType === WrapType.WRAP ? 'Wrap' : 'Unwrap'}
          </Text>
        </Button>
      </View>
    );
  }

  if (showWrap) {
    const handleWrap = async () => {
      try {
        track(TRACKING_EVENTS.WRAP_INITIATED, {
          wrap_type: String(wrapType),
          input_currency: currencies[SwapField.INPUT]?.symbol,
          output_currency: currencies[SwapField.OUTPUT]?.symbol,
          amount: typedValue,
        });

        Sentry.addBreadcrumb({
          message: 'Wrap/Unwrap initiated',
          category: 'swap',
          level: 'info',
          data: {
            wrapType,
            inputCurrency: currencies[SwapField.INPUT]?.symbol,
            outputCurrency: currencies[SwapField.OUTPUT]?.symbol,
            amount: typedValue,
          },
        });

        if (onWrap) {
          setTransaction({
            amount: Number(typedValue || '0'),
            address: currencies[SwapField.INPUT]?.wrapped.address as Address,
            inputCurrencySymbol: currencies[SwapField.INPUT]?.symbol,
            outputCurrencySymbol: currencies[SwapField.OUTPUT]?.symbol,
          });

          const result = await onWrap();

          if (result !== undefined) {
            track(TRACKING_EVENTS.WRAP_COMPLETED, {
              wrap_type: String(wrapType),
              input_currency: currencies[SwapField.INPUT]?.symbol,
              output_currency: currencies[SwapField.OUTPUT]?.symbol,
              amount: typedValue,
            });
            setModal(SWAP_MODAL.OPEN_TRANSACTION_STATUS);
            resetForm();
          }
        }
      } catch (error: any) {
        console.error('❌ Wrap/Unwrap failed:', error);

        track(TRACKING_EVENTS.WRAP_FAILED, {
          wrap_type: String(wrapType),
          input_currency: currencies[SwapField.INPUT]?.symbol,
          output_currency: currencies[SwapField.OUTPUT]?.symbol,
          amount: typedValue,
          error: String(error),
        });

        Sentry.captureException(error, {
          tags: {
            type: 'wrap_button_error',
            wrapType: String(wrapType),
          },
          extra: {
            inputCurrency: currencies[SwapField.INPUT]?.symbol,
            outputCurrency: currencies[SwapField.OUTPUT]?.symbol,
            amount: typedValue,
          },
        });
      }
    };

    return (
      <Button className="rounded-xl" variant="brand" size="lg" onPress={handleWrap}>
        {isWrapLoading ? (
          <Text className="text-base font-semibold">
            {wrapType === WrapType.WRAP ? 'Wrapping...' : 'Unwrapping...'}
          </Text>
        ) : wrapType === WrapType.WRAP ? (
          <View className="flex-row items-center gap-2">
            <Image source={getAsset('images/security_key.png')} style={{ width: 21, height: 10 }} />
            <Text className="text-base font-semibold">Wrap</Text>
          </View>
        ) : (
          <View className="flex-row items-center gap-2">
            <Image source={getAsset('images/security_key.png')} style={{ width: 21, height: 10 }} />
            <Text className="text-base font-semibold">Unwrap</Text>
          </View>
        )}
      </Button>
    );
  }

  const isAnyLoading =
    isSubmitting || isWrapLoading || isPegSwapLoading || isSwapLoading || isVoltageSwapLoading;

  const isButtonDisabled = Boolean(
    disabled ||
    !isValid ||
    !typedValue ||
    !userHasSpecifiedInputOutput ||
    !selectedSwapCallback ||
    routeNotFound ||
    priceImpactTooHigh ||
    isSubmitting ||
    isLoadingRoute ||
    isVoltageTradeLoading ||
    (isVoltageTrade && isVoltageSwapLoading) ||
    isSwapLoading ||
    isVoltageSwapLoading,
  );

  const quoteError =
    typedValue && !isLoadingRoute && !isVoltageTradeLoading && !selectedSwapCallback
      ? selectedCallbackError || 'Unable to get a quote. Try another amount.'
      : undefined;
  const noRouteError =
    routeNotFound && userHasSpecifiedInputOutput && !isLoadingRoute && !isVoltageTradeLoading
      ? 'We couldn’t get a price. Try a different amount.'
      : undefined;
  const errorMessage =
    swapInputError ||
    (priceImpactTooHigh ? 'Price Impact Too High' : undefined) ||
    submissionError ||
    noRouteError ||
    quoteError;

  return (
    <View>
      {errorMessage && <ErrorMessage message={errorMessage} />}
      <Button
        className="rounded-xl"
        variant="brand"
        size="lg"
        onPress={handleSwap}
        disabled={isButtonDisabled}
      >
        {isAnyLoading ? (
          <Text className="text-base font-bold">Processing Transaction...</Text>
        ) : typedValue && (isLoadingRoute || isVoltageTradeLoading) ? (
          <Text className="text-base font-bold">Finding Routes...</Text>
        ) : typedValue && (!selectedSwapCallback || routeNotFound) ? (
          <Text className="text-base font-bold">{label}</Text>
        ) : priceImpactSeverity > 2 && !priceImpactTooHigh ? (
          <Text className="text-base font-bold">Swap Anyway</Text>
        ) : needsApproval ? (
          <Text className="text-base font-bold">Approve & Swap</Text>
        ) : !typedValue ? (
          <Text className="text-base font-bold">Enter an amount</Text>
        ) : (
          <View className="flex-row items-center gap-2">
            {showSecurityIcon && (
              <Image
                source={getAsset('images/security_key.png')}
                style={{ width: 21, height: 10 }}
              />
            )}
            <Text className="text-base font-bold">{label}</Text>
          </View>
        )}
      </Button>
    </View>
  );
};

const ErrorMessage = ({ message }: { message: string }) => (
  <View className="mb-3 flex-row items-center gap-2">
    <InfoError />
    <Text className="text-sm text-red-400">{message}</Text>
  </View>
);

export default SwapButton;
