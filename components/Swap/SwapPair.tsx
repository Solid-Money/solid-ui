import { ArrowUpDown } from 'lucide-react-native';
import React, { useCallback, useMemo } from 'react';
import { View } from 'react-native';

import { Button } from '@/components/ui/button';
import usePegSwapCallback, { PegSwapType } from '@/hooks/swap/usePegswapCallback';
import useWrapCallback, { WrapType } from '@/hooks/swap/useWrapCallback';
import { useUSDCValue } from '@/hooks/useUSDCValue';
import { SwapField, SwapFieldType } from '@/lib/types/swap-field';
import { useDerivedSwapInfo, useSwapActionHandlers, useSwapState } from '@/store/swapStore';
import { Currency, CurrencyAmount, maxAmountSpend, tryParseAmount } from '@cryptoalgebra/fuse-sdk';
import TokenCard from './TokenCard';

const SwapPair: React.FC = () => {
  const {
    toggledTrade: trade,
    currencyBalances,
    parsedAmount,
    currencies,
    voltageTrade,
    isVoltageTrade,
    isVoltageTradeLoading,
    tradeState,
  } = useDerivedSwapInfo();

  const baseCurrency = currencies[SwapField.INPUT];
  const quoteCurrency = currencies[SwapField.OUTPUT];

  const { independentField, typedValue } = useSwapState();
  const dependentField: SwapFieldType =
    independentField === SwapField.INPUT ? SwapField.OUTPUT : SwapField.INPUT;

  const { onSwitchTokens, onCurrencySelection, onUserInput } = useSwapActionHandlers();

  const handleInputSelect = useCallback(
    (inputCurrency: Currency) => {
      onCurrencySelection(SwapField.INPUT, inputCurrency);
    },
    [onCurrencySelection],
  );

  const handleOutputSelect = useCallback(
    (outputCurrency: Currency) => {
      onCurrencySelection(SwapField.OUTPUT, outputCurrency);
    },
    [onCurrencySelection],
  );

  const handleTypeInput = useCallback(
    (value: string) => {
      onUserInput(SwapField.INPUT, value);
    },
    [onUserInput],
  );
  const handleTypeOutput = useCallback(
    (value: string) => {
      onUserInput(SwapField.OUTPUT, value);
    },
    [onUserInput],
  );

  const { wrapType } = useWrapCallback(
    currencies[SwapField.INPUT],
    currencies[SwapField.OUTPUT],
    typedValue,
  );

  const { pegSwapType } = usePegSwapCallback(
    currencies[SwapField.INPUT],
    currencies[SwapField.OUTPUT],
    typedValue,
  );

  const showWrap: boolean = wrapType !== WrapType.NOT_APPLICABLE;

  const showPegSwap: boolean = pegSwapType !== PegSwapType.NOT_APPLICABLE;

  const parsedAmountA = useMemo(() => {
    if (isVoltageTradeLoading || tradeState.state === 'LOADING') return;
    return independentField === SwapField.INPUT
      ? parsedAmount
      : isVoltageTrade
        ? voltageTrade?.trade?.inputAmount
        : trade?.inputAmount;
  }, [
    independentField,
    parsedAmount,
    isVoltageTrade,
    voltageTrade?.trade?.inputAmount,
    trade?.inputAmount,
    isVoltageTradeLoading,
    tradeState.state,
  ]);

  const parsedAmountB = useMemo(() => {
    if (isVoltageTradeLoading || tradeState.state === 'LOADING') return;
    return independentField === SwapField.OUTPUT
      ? parsedAmount
      : isVoltageTrade
        ? voltageTrade?.trade?.outputAmount
        : trade?.outputAmount;
  }, [
    independentField,
    parsedAmount,
    isVoltageTrade,
    voltageTrade?.trade?.outputAmount,
    trade?.outputAmount,
    isVoltageTradeLoading,
    tradeState.state,
  ]);

  const parsedAmounts = useMemo(
    () =>
      showWrap || showPegSwap
        ? {
            [SwapField.INPUT]: parsedAmount,
            [SwapField.OUTPUT]: parsedAmount,
          }
        : {
            [SwapField.INPUT]: parsedAmountA,
            [SwapField.OUTPUT]: parsedAmountB,
          },
    [showWrap, showPegSwap, parsedAmount, parsedAmountA, parsedAmountB],
  );

  const maxInputAmount: CurrencyAmount<Currency> | undefined = maxAmountSpend(
    currencyBalances[SwapField.INPUT],
  );
  const showMaxButton = Boolean(
    maxInputAmount?.greaterThan(0) && !parsedAmounts[SwapField.INPUT]?.equalTo(maxInputAmount),
  );

  const handleMaxInput = useCallback(() => {
    maxInputAmount && onUserInput(SwapField.INPUT, maxInputAmount.toExact());
  }, [maxInputAmount, onUserInput]);

  const inputAmountForFiat = useMemo(() => {
    const amount = parsedAmounts[SwapField.INPUT];
    return amount
      ? tryParseAmount(amount.toSignificant((amount.currency.decimals || 6) / 2), baseCurrency)
      : undefined;
  }, [parsedAmounts, baseCurrency]);

  const outputAmountForFiat = useMemo(() => {
    const amount = parsedAmounts[SwapField.OUTPUT];
    return amount
      ? tryParseAmount(amount.toSignificant((amount.currency.decimals || 6) / 2), quoteCurrency)
      : undefined;
  }, [parsedAmounts, quoteCurrency]);

  const { formatted: fiatValueInputFormatted } = useUSDCValue(inputAmountForFiat);
  const { formatted: fiatValueOutputFormatted } = useUSDCValue(outputAmountForFiat);

  const formattedAmounts = useMemo(
    () => ({
      [independentField]: typedValue,
      [dependentField]:
        isVoltageTradeLoading || tradeState.state === 'LOADING'
          ? '...'
          : showWrap || showPegSwap
            ? (parsedAmounts[independentField]?.toExact() ?? '')
            : (parsedAmounts[dependentField]?.toFixed(
                (parsedAmounts[dependentField]?.currency.decimals || 6) / 2,
              ) ?? ''),
    }),
    [
      independentField,
      dependentField,
      typedValue,
      showWrap,
      showPegSwap,
      parsedAmounts,
      isVoltageTradeLoading,
      tradeState.state,
    ],
  );

  return (
    <View className="flex flex-col gap-2 relative">
      <TokenCard
        value={formattedAmounts[SwapField.INPUT] || ''}
        currency={baseCurrency}
        otherCurrency={quoteCurrency}
        handleTokenSelection={handleInputSelect}
        handleValueChange={handleTypeInput}
        handleMaxValue={handleMaxInput}
        fiatValue={fiatValueInputFormatted ?? undefined}
        showMaxButton={showMaxButton}
        showBalance={true}
        title="Pay"
      />

      <View className="flex-row justify-center absolute top-1/2 -translate-y-1/2 left-0 right-0 z-10">
        <Button
          variant="outline"
          size="icon"
          onPress={onSwitchTokens}
          className="bg-background border-0 rounded-full w-12 h-12 z-10 shadow-sm web:hover:bg-accent"
        >
          <ArrowUpDown size={20} color="white" />
        </Button>
      </View>

      <TokenCard
        value={formattedAmounts[SwapField.OUTPUT] || ''}
        currency={quoteCurrency}
        otherCurrency={baseCurrency}
        handleTokenSelection={handleOutputSelect}
        handleValueChange={handleTypeOutput}
        fiatValue={fiatValueOutputFormatted ?? undefined}
        showBalance={true}
        title="Receive"
        isLoading={isVoltageTradeLoading || tradeState.state === 'LOADING'}
      />
    </View>
  );
};

export default SwapPair;
