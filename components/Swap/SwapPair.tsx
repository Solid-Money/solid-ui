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
    if (isVoltageTradeLoading) return;
    return independentField === SwapField.INPUT
      ? parsedAmount
      : isVoltageTrade
        ? voltageTrade?.trade?.inputAmount
        : trade?.inputAmount;
  }, [independentField, parsedAmount, isVoltageTrade, voltageTrade, trade, isVoltageTradeLoading]);

  const parsedAmountB = useMemo(() => {
    if (isVoltageTradeLoading) return;
    return independentField === SwapField.OUTPUT
      ? parsedAmount
      : isVoltageTrade
        ? voltageTrade?.trade?.outputAmount
        : trade?.outputAmount;
  }, [independentField, parsedAmount, isVoltageTrade, voltageTrade, trade, isVoltageTradeLoading]);

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

  const { formatted: fiatValueInputFormatted } = useUSDCValue(
    tryParseAmount(
      parsedAmounts[SwapField.INPUT]?.toSignificant(
        (parsedAmounts[SwapField.INPUT]?.currency.decimals || 6) / 2,
      ),
      baseCurrency,
    ),
  );
  const { formatted: fiatValueOutputFormatted } = useUSDCValue(
    tryParseAmount(
      parsedAmounts[SwapField.OUTPUT]?.toSignificant(
        (parsedAmounts[SwapField.OUTPUT]?.currency.decimals || 6) / 2,
      ),
      quoteCurrency,
    ),
  );

  const formattedAmounts = {
    [independentField]: typedValue,
    [dependentField]:
      showWrap || showPegSwap
        ? (parsedAmounts[independentField]?.toExact() ?? '')
        : (parsedAmounts[dependentField]?.toFixed(
            (parsedAmounts[dependentField]?.currency.decimals || 6) / 2,
          ) ?? ''),
  };

  return (
    <View className="flex flex-col gap-1 relative p-6">
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

      <View className="flex-row justify-center py-4 relative">
        <View className="absolute inset-0 flex-row items-center">
          <View className="flex-1 h-px bg-border/30" />
          <View className="flex-1 h-px bg-border/30" />
        </View>

        <Button
          variant="outline"
          size="icon"
          onPress={onSwitchTokens}
          className="bg-background border-border/20 rounded-full w-12 h-12 z-10 shadow-sm web:hover:bg-accent"
        >
          <ArrowUpDown size={20} color="#888" />
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
      />
    </View>
  );
};

export default SwapPair;
