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
  if (initialLoading) {
    return <RateLoadingIndicator size="small" />;
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
    <View className="flex-row items-center">
      <Text className="text-base font-bold text-white">
        1 {fromCurrency.toUpperCase()} {symbol} {Number(rate).toString()} {toCurrency.toUpperCase()}
      </Text>
      {loading && (
        <View className="ml-2">
          <RateLoadingIndicator size="small" />
        </View>
      )}
    </View>
  );
};
