import {
  BridgeTransferCryptoCurrency,
  BridgeTransferFiatCurrency,
} from '@/components/BankTransfer/enums';
import { PaymentMethodList } from '@/components/BankTransfer/payment/PaymentMethodList';
import { useCustomer } from '@/hooks/useCustomer';
import { createBridgeTransfer } from '@/lib/api';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect } from 'react';
import { View } from 'react-native';

export default function BankTransferPaymentMethodScreen() {
  const params = useLocalSearchParams<{
    fiat?: BridgeTransferFiatCurrency;
    crypto?: BridgeTransferCryptoCurrency;
    fiatAmount?: string;
    cryptoAmount?: string;
    method?: string;
  }>();
  const { data: customer } = useCustomer();

  const createInstructions = useCallback(async () => {
    const instructions = await createBridgeTransfer({
      amount: String(params.fiatAmount ?? ''),
      sourcePaymentRail: params.method as any,
      fiatCurrency: params.fiat as any,
      cryptoCurrency: String(params.crypto ?? ''),
    });

    router.replace({
      pathname: '/bank-transfer/preview',
      params: { instructions: JSON.stringify(instructions) },
    });
  }, [params.fiatAmount, params.method, params.fiat, params.crypto]);

  useEffect(() => {
    // Auto-resume: if user returned from KYC with a chosen method and we now
    // have a customer, proceed with the instructions creation.
    if (customer && params.method && params.fiat && params.fiatAmount) {
      createInstructions();
    }
  }, [customer, params.method, params.fiat, params.fiatAmount, params.crypto, createInstructions]);

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
