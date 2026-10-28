import React, { useCallback, useMemo } from 'react';
import { Pressable, View } from 'react-native';
import { Image } from 'expo-image';
import { formatUnits } from 'viem';

import TokenCard from '@/components/Swap/TokenCard';
import { useLifiSwapInfo } from '@/hooks/swap/useLifiSwapInfo';
import { getAsset } from '@/lib/assets';
import { SwapAsset, SwapAssetWithBalance } from '@/lib/types/lifi-swap';
import { SwapField } from '@/lib/types/swap-field';
import { useSwapActionHandlers, useSwapState } from '@/store/swapStore';

/** Significant digits for the quoted output: enough to compare, few enough to read. */
const formatOutput = (raw: string, decimals: number) => {
  const value = Number(formatUnits(BigInt(raw), decimals));
  if (value === 0) return '0';
  return value >= 1
    ? value.toFixed(Math.min(6, decimals)).replace(/\.?0+$/, '')
    : value.toPrecision(6);
};

const balanceOf = (asset: SwapAsset | undefined): number | undefined =>
  asset && 'balance' in asset ? (asset as SwapAssetWithBalance).balance : undefined;

const priceOf = (asset: SwapAsset | undefined): number =>
  asset && 'priceUsd' in asset ? (asset as SwapAssetWithBalance).priceUsd : 0;

/**
 * An amount's dollar value at the wallet's price, or the quote's when the
 * wallet has none. The wallet's is there as soon as the amount is typed, and
 * stays put while the quote reloads; the quote's only once LI.FI answers.
 */
export const fiatValueOf = (
  amount: number,
  asset: SwapAsset | undefined,
  quotedUsd: string | null | undefined,
): number | undefined => {
  const price = priceOf(asset);
  if (price > 0 && amount > 0) return amount * price;
  return quotedUsd ? Number(quotedUsd) : undefined;
};

/**
 * The From/To cards for a swap that leaves Fuse. Exact-in only: the To card
 * shows LI.FI's quote and can't be typed into.
 */
const LifiSwapPair: React.FC = () => {
  const { fromAsset, toAsset, fromBalance, quote, isQuoting } = useLifiSwapInfo();
  const typedValue = useSwapState(state => state.typedValue);
  const { onSwitchTokens, onAssetSelection, onUserInput } = useSwapActionHandlers();

  const handleInputSelect = useCallback(
    (asset: SwapAsset) => onAssetSelection(SwapField.INPUT, asset),
    [onAssetSelection],
  );
  const handleOutputSelect = useCallback(
    (asset: SwapAsset) => onAssetSelection(SwapField.OUTPUT, asset),
    [onAssetSelection],
  );
  const handleTypeInput = useCallback(
    (value: string) => onUserInput(SwapField.INPUT, value),
    [onUserInput],
  );

  // Gas is sponsored, so the whole balance can go, native currency included.
  const maxValue = useMemo(
    () =>
      fromAsset && fromBalance && fromBalance > 0n
        ? formatUnits(fromBalance, fromAsset.decimals)
        : undefined,
    [fromAsset, fromBalance],
  );
  const handleMaxInput = useCallback(() => {
    if (maxValue) onUserInput(SwapField.INPUT, maxValue);
  }, [maxValue, onUserInput]);

  const outputValue = useMemo(() => {
    if (!typedValue) return '';
    if (isQuoting) return '...';
    return quote ? formatOutput(quote.toAmount, quote.toToken.decimals) : '';
  }, [typedValue, isQuoting, quote]);

  const inputFiat = useMemo(
    () =>
      fiatValueOf(
        Number(typedValue) || 0,
        fromAsset,
        quote && !isQuoting ? quote.fromAmountUsd : undefined,
      ),
    [typedValue, fromAsset, quote, isQuoting],
  );
  const outputFiat = useMemo(() => {
    if (!quote || isQuoting) return undefined;
    const amount = Number(formatUnits(BigInt(quote.toAmount), quote.toToken.decimals));
    return fiatValueOf(amount, toAsset, quote.toAmountUsd);
  }, [quote, isQuoting, toAsset]);

  return (
    <View className="relative flex flex-col gap-4">
      <TokenCard
        value={typedValue}
        asset={fromAsset}
        otherAsset={toAsset}
        balance={balanceOf(fromAsset)}
        handleTokenSelection={handleInputSelect}
        handleValueChange={handleTypeInput}
        handleMaxValue={handleMaxInput}
        fiatValue={inputFiat}
        showMaxButton={!!maxValue && typedValue !== maxValue}
        showBalance
        title="From"
      />

      <View className="z-10 mt-2 flex-row items-center justify-center">
        <View className="absolute left-0 right-0 h-[1px] bg-white/20" />
        <Pressable onPress={onSwitchTokens} className="z-10" accessibilityLabel="Switch tokens">
          <Image source={getAsset('images/swap_circle.png')} style={{ width: 34, height: 34 }} />
        </Pressable>
      </View>

      <TokenCard
        value={outputValue}
        asset={toAsset}
        otherAsset={fromAsset}
        balance={balanceOf(toAsset)}
        handleTokenSelection={handleOutputSelect}
        fiatValue={outputFiat}
        showBalance={false}
        title="To"
        side="get"
        disabled
        isLoading={isQuoting}
      />
    </View>
  );
};

export default LifiSwapPair;
