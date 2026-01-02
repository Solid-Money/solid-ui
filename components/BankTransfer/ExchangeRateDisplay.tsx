import { Text } from '@/components/ui/text';
import { View } from 'react-native';
import { BridgeTransferCryptoCurrency, BridgeTransferFiatCurrency } from './enums';
import { RateLoadingIndicator } from './RateLoadingIndicator';

interface ExchangeRateDisplayProps {
  rate?: string;
  fromCurrency: BridgeTransferFiatCurrency | BridgeTransferCryptoCurrency;
  toCurrency: BridgeTransferFiatCurrency | BridgeTransferCryptoCurrency;
  loading: boolean;
  initialLoading: boolean;
}

export const ExchangeRateDisplay = ({
  rate,
  fromCurrency,
  toCurrency,
  loading,
  initialLoading,
}: ExchangeRateDisplayProps) => {
  // Show centered loading indicator when getting initial rate
  if (initialLoading) {
    return (
      <View className="mt-2 items-center">
        <RateLoadingIndicator />
      </View>
    );
  }

  if (!rate) return null;

  const isFromUSDBased =
    fromCurrency === BridgeTransferFiatCurrency.USD ||
    fromCurrency === BridgeTransferCryptoCurrency.USDC ||
    fromCurrency === BridgeTransferCryptoCurrency.USDT;

  const isToUSDBased =
    toCurrency === BridgeTransferFiatCurrency.USD ||
    toCurrency === BridgeTransferCryptoCurrency.USDC ||
    toCurrency === BridgeTransferCryptoCurrency.USDT;

  const symbol = isFromUSDBased && isToUSDBased ? '=' : '~';

  return (
    <View className="mt-2 flex-row items-center justify-center">
      <Text className="font-medium text-[#A1A1A1]">
        1 {fromCurrency.toUpperCase()} {symbol} {Number(rate).toString()} {toCurrency.toUpperCase()}
      </Text>
      {loading && (
        <View className="ml-2">
          <RateLoadingIndicator />
        </View>
      )}
    </View>
  );
};
