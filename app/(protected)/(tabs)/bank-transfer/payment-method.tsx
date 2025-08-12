import {
  BridgeTransferCryptoCurrency,
  BridgeTransferFiatCurrency,
} from '@/components/BankTransfer/enums';
import { PaymentMethodList } from '@/components/BankTransfer/payment/PaymentMethodList';
import { useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';

export default function BankTransferPaymentMethodScreen() {
  const params = useLocalSearchParams<{
    fiat?: BridgeTransferFiatCurrency;
    crypto?: BridgeTransferCryptoCurrency;
    fiatAmount?: string;
    cryptoAmount?: string;
  }>();

  return (
    <View className="flex-1 bg-background p-6">
      <View className="w-full web:max-w-3xl web:mx-auto">
        <PaymentMethodList
          fiat={params.fiat as BridgeTransferFiatCurrency}
          crypto={params.crypto as BridgeTransferCryptoCurrency}
          fiatAmount={params.fiatAmount}
          cryptoAmount={params.cryptoAmount}
        />
      </View>
    </View>
  );
}
