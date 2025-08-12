import { Text } from '@/components/ui/text';
import { path } from '@/constants/path';
import { useCustomer } from '@/hooks/useCustomer';
import { createBridgeTransfer } from '@/lib/api';
import { router } from 'expo-router';
import { View } from 'react-native';
import {
  BridgeTransferCryptoCurrency,
  BridgeTransferFiatCurrency,
  BridgeTransferMethod,
  METHOD_LABEL,
} from '../enums';
import { PaymentMethodTile } from './PaymentMethodTile';

type Props = {
  fiat?: BridgeTransferFiatCurrency;
  crypto?: BridgeTransferCryptoCurrency;
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
  const { data: customer } = useCustomer();

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
              // If user doesn't have a Bridge customer yet, collect info and start KYC first.
              // We include a serialized `returnTo` payload so that, after KYC completes,
              // we can resume this exact bank-transfer flow with the selected parameters.
              if (!customer) {
                const resume = {
                  pathname: '/bank-transfer/payment-method',
                  params: {
                    fiat: normalizedFiat,
                    crypto: crypto ?? '',
                    fiatAmount: String(fiatAmount ?? ''),
                    method,
                  },
                } as const;

                // If method is SEPA, add the sepa endorsement
                const endorsements = [];

                if (method === BridgeTransferMethod.SEPA) {
                  endorsements.push('sepa');
                } else if (method === BridgeTransferMethod.SPEI) {
                  endorsements.push('spei');
                } else {
                  endorsements.push('base');
                }

                // Push to the KYC info screen and attach returnTo so it can be forwarded to KYC provider
                router.push({
                  pathname: path.USER_KYC_INFO as any,
                  params: {
                    returnTo: JSON.stringify(resume),
                    kycMode: 'bankTransfer',
                    endorsements: endorsements.join(','),
                  },
                });
                return;
              }

              // Customer exists.
              // TODO: Check the KYC status.

              // TODO: Check endorsements for existing customer before proceeding

              const sourceDepositInstructions = await createBridgeTransfer({
                amount: String(fiatAmount ?? ''),
                sourcePaymentRail: method,
                fiatCurrency: normalizedFiat,
                cryptoCurrency: String(crypto ?? ''),
              });

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
