import { Text } from '@/components/ui/text';
import { createBridgeTransfer } from '@/lib/api';
import { router } from 'expo-router';
import { View } from 'react-native';
import { BridgeTransferFiatCurrency, BridgeTransferMethod, METHOD_LABEL } from '../enums';
import { PaymentMethodTile } from './PaymentMethodTile';
import { SourceDepositInstructions } from '@/lib/types';

type Props = {
  fiat?: BridgeTransferFiatCurrency | string;
  crypto?: string;
  fiatAmount?: string;
  cryptoAmount?: string;
};

const ALL_METHODS: BridgeTransferMethod[] = [
  BridgeTransferMethod.ACH,
  BridgeTransferMethod.ACH_PUSH,
  BridgeTransferMethod.WIRE,
  BridgeTransferMethod.SEPA,
  BridgeTransferMethod.SPEI,
  BridgeTransferMethod.SWIFT,
];

export function PaymentMethodList({ fiat, crypto, fiatAmount }: Props) {
  const normalizedFiat = (fiat || '') as BridgeTransferFiatCurrency;

  let filtered: BridgeTransferMethod[] = ALL_METHODS;
  if (normalizedFiat === BridgeTransferFiatCurrency.EUR) {
    filtered = [BridgeTransferMethod.SEPA];
    // TODO: Check if there is a limitation regarding the MXN. Remove the if there isn't.
  } else if (normalizedFiat === BridgeTransferFiatCurrency.MXN) {
    filtered = [BridgeTransferMethod.SPEI];
  }

  return (
    <View className="gap-3">
      {filtered.map(method => (
        <PaymentMethodTile
          key={method}
          title={METHOD_LABEL[method]}
          onPress={async () => {
            try {
              // const res = await createBridgeTransfer({
              //   amount: String(fiatAmount ?? ''),
              //   sourcePaymentRail: method,
              //   fiatCurrency: normalizedFiat,
              //   cryptoCurrency: String(crypto ?? ''),
              // });

              const sourceDepositInstructions: SourceDepositInstructions = {
                payment_rail: method,
                currency: normalizedFiat,
                amount: String(fiatAmount ?? ''),
                deposit_message: 'Deposit message',
                bank_account_number: '1234567890',
                bank_routing_number: '1234567890',
                bank_beneficiary_name: 'John Doe',
                bank_beneficiary_address: '123 Main St, Anytown, USA',
                bank_name: 'Bank of America',
                bank_address: '123 Main St, Anytown, USA',
              };

              router.push({
                pathname: '/bank-transfer/preview',
                params: {
                  instructions: JSON.stringify(sourceDepositInstructions),
                },
              });
            } catch (err) {
              console.error('createBridgeTransfer failed', err);
            }
          }}
        />
      ))}
      {filtered.length === 0 && (
        <View className="items-center justify-center py-10">
          <Text className="text-muted-foreground">No payment methods available</Text>
        </View>
      )}
    </View>
  );
}
