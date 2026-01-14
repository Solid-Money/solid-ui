import React, { useCallback, useMemo } from 'react';
import { View } from 'react-native';
import { Image } from 'expo-image';
import { tryParseAmount } from '@cryptoalgebra/fuse-sdk';
import * as Sentry from '@sentry/react-native';
import { Address } from 'viem';

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
import { useUserState } from '@/store/userStore';

const SwapButton: React.FC = () => {
  const { isExpertMode } = useUserState();
  const { user } = useUser();

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

  const showWrap = wrapType !== WrapType.NOT_APPLICABLE;

  // Create success handlers for different transaction types
  const createSwapSuccessHandler = useCallback(
    (inputSymbol: string, outputSymbol: string, inputAmount: string, _outputAmount?: string) =>
      () => {
        setTransaction({
          amount: Number(inputAmount),
          address: currencies[SwapField.INPUT]?.wrapped.address as Address,
          inputCurrencySymbol: inputSymbol,
          outputCurrencySymbol: outputSymbol,
        });

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

  // Get peg swap calldata for batch operations
  const inputAmount = useMemo(
    () => tryParseAmount(typedValue, currencies[SwapField.INPUT]),
    [currencies, typedValue],
  );

  const {
    callback: swapCallback,
    isLoading: isSwapLoading,
    needAllowance: needSwapAllowance,
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

      if (isVoltageTrade) {
        if (!voltageSwapCallback) return;
        await voltageSwapCallback();
      } else {
        if (!swapCallback) return;
        await swapCallback();
      }

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
      return new Error(`Swap Failed ${error}`);
    }
  }, [
    swapCallback,
    voltageSwapCallback,
    isVoltageTrade,
    currencies,
    trade,
    allowedSlippage,
    priceImpactSeverity,
    needsApproval,
    user?.userId,
    user?.safeAddress,
  ]);

  const handlePegSwap = useCallback(async () => {
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
    }
  }, [
    pegSwapCallback,
    pegSwapType,
    currencies,
    inputAmount,
    needPegSwapAllowance,
    user?.userId,
    user?.safeAddress,
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
          disabled={isPegSwapLoading || !!pegSwapInputError}
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
      <Button className="rounded-xl" size="lg" onPress={handleWrap}>
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
          <Text className="text-base font-semibold">Unwrap</Text>
        )}
      </Button>
    );
  }

  if (routeNotFound && userHasSpecifiedInputOutput) {
    return (
      <View>
        {!isLoadingRoute && <ErrorMessage message="Insufficient liquidity for this trade." />}
        <Button className="rounded-xl" size="lg" disabled>
          {isLoadingRoute ? (
            <Text className="text-base font-semibold">Finding Routes...</Text>
          ) : (
            <Text className="text-base font-semibold">Swap</Text>
          )}
        </Button>
      </View>
    );
  }

  const isAnyLoading = isWrapLoading || isPegSwapLoading || isSwapLoading || isVoltageSwapLoading;

  const isButtonDisabled =
    !isValid ||
    !typedValue ||
    priceImpactTooHigh ||
    isVoltageTradeLoading ||
    (isVoltageTrade && isVoltageSwapLoading) ||
    isSwapLoading ||
    isVoltageSwapLoading;

  const errorMessage = swapInputError || (priceImpactTooHigh ? 'Price Impact Too High' : null);

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
          <Text className="text-base font-semibold">Processing Transaction...</Text>
        ) : priceImpactSeverity > 2 && !priceImpactTooHigh ? (
          <Text className="text-base font-semibold">Swap Anyway</Text>
        ) : needsApproval ? (
          <Text className="text-base font-semibold">Approve & Swap</Text>
        ) : !typedValue ? (
          <Text className="text-base font-semibold">Enter an amount</Text>
        ) : (
          <View className="flex-row items-center gap-2">
            <Image source={getAsset('images/security_key.png')} style={{ width: 21, height: 10 }} />
            <Text className="text-base font-semibold">Swap</Text>
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
