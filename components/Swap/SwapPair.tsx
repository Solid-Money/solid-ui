import usePegSwapCallback, { PegSwapType } from '@/hooks/swap/usePegswapCallback';
import useWrapCallback, { WrapType } from '@/hooks/swap/useWrapCallback';
import { useUSDCValue } from '@/hooks/useUSDCValue';
import { SwapField, SwapFieldType } from '@/lib/types/swap-field';
import { useDerivedSwapInfo, useSwapActionHandlers, useSwapState } from '@/store/swapStore';
import { Currency, CurrencyAmount, tryParseAmount } from '@cryptoalgebra/fuse-sdk';
import React, { useCallback, useMemo } from 'react';
import { Image, Pressable, View } from 'react-native';

import { getAsset } from '@/lib/assets';
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

  const maxInputAmount: CurrencyAmount<Currency> | undefined = useMemo(() => {
    const balance = currencyBalances[SwapField.INPUT];
    if (!balance) return undefined;

    // For AA wallets with paymaster, no gas reservation needed at all!
    // Use the full balance for both native tokens and ERC20 tokens
    return balance;
  }, [currencyBalances]);
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
    <View className="relative flex flex-col gap-4">
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
        title="From"
      />

      <View className="z-10 mt-2 flex-row items-center justify-center">
        <View className="absolute left-0 right-0 h-[1px] bg-white/20" />
        <Pressable onPress={onSwitchTokens} className="z-10">
          <Image source={getAsset('images/swap_circle.png')} style={{ width: 34, height: 34 }} />
        </Pressable>
      </View>

      <TokenCard
        value={formattedAmounts[SwapField.OUTPUT] || ''}
        currency={quoteCurrency}
        otherCurrency={baseCurrency}
        handleTokenSelection={handleOutputSelect}
        handleValueChange={handleTypeOutput}
        fiatValue={fiatValueOutputFormatted ?? undefined}
        showBalance={false}
        title="To"
        isLoading={isVoltageTradeLoading || tradeState.state === 'LOADING'}
      />
    </View>
  );
};

export default SwapPair;
