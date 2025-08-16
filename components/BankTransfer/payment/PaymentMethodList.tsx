import { KycMode } from '@/app/(protected)/(tabs)/user-kyc-info';
import {
  BridgeTransferCryptoCurrency,
  BridgeTransferFiatCurrency,
  BridgeTransferMethod,
  Endorsements,
  EndorsementStatus,
  METHOD_LABEL,
} from '@/components/BankTransfer/enums';
import { Text } from '@/components/ui/text';
import { useCustomer } from '@/hooks/useCustomer';
import {
  createBridgeTransfer,
  getCustomerEndorsements,
  getKycLinkForExistingCustomer,
} from '@/lib/api';
import { startKycFlow } from '@/lib/utils/kyc';
import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
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
  const [loadingMethod, setLoadingMethod] = useState<BridgeTransferMethod | null>(null);

  let filtered: BridgeTransferMethod[] = ALL_METHODS;

  if (normalizedFiat === BridgeTransferFiatCurrency.EUR) {
    filtered = [BridgeTransferMethod.SEPA];
  } else if (normalizedFiat === BridgeTransferFiatCurrency.MXN) {
    filtered = [BridgeTransferMethod.SPEI];
  } else if (normalizedFiat === BridgeTransferFiatCurrency.USD) {
    filtered = [
      BridgeTransferMethod.ACH,
      BridgeTransferMethod.ACH_PUSH,
      BridgeTransferMethod.WIRE,
      BridgeTransferMethod.SWIFT,
    ];
  }

  return (
    <View className="gap-3">
      {filtered.map(method => (
        <PaymentMethodTile
          key={method}
          title={METHOD_LABEL[method]}
          onPress={() => onPressed(method)}
          loading={loadingMethod === method}
          disabled={Boolean(loadingMethod)}
        />
      ))}
      {filtered.length === 0 && (
        <View className="items-center justify-center py-10">
          <Text className="text-muted-foreground">No payment methods available</Text>
        </View>
      )}
    </View>
  );

  async function onPressed(method: BridgeTransferMethod) {
    try {
      setLoadingMethod(method);
      if (!customer) {
        const redirectUri = buildResumeRedirectUri({
          pathname: '/bank-transfer/payment-method',
          params: {
            fiat: normalizedFiat,
            crypto: String(crypto ?? ''),
            fiatAmount: String(fiatAmount ?? ''),
            method,
          },
        });

        const endorsement = getEndorsementByMethod(method);

        const params = new URLSearchParams({
          kycMode: KycMode.BANK_TRANSFER,
          endorsement: endorsement,
          redirectUri,
        }).toString();

        router.push(`/user-kyc-info?${params}`);

        return;
      }

      // Check if the customer has the required endorsement approved
      const endorsements = await getCustomerEndorsements();
      const requiredEndorsement = getEndorsementByMethod(method);

      const endorsement = endorsements?.find(
        endorsement => endorsement.name === requiredEndorsement,
      );

      if (!endorsement || endorsement.status !== EndorsementStatus.APPROVED) {
        await startKycFlowForExistingCustomer(method, requiredEndorsement);
        return;
      }

      await createTransfer(method);
    } catch (err) {
      console.error('createBridgeTransfer failed', err);
    } finally {
      setLoadingMethod(null);
    }
  }

  async function createTransfer(method: BridgeTransferMethod) {
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
  }

  async function startKycFlowForExistingCustomer(
    method: BridgeTransferMethod,
    requiredEndorsement: Endorsements,
  ) {
    const redirectUrl = buildResumeRedirectUri({
      pathname: '/bank-transfer/payment-method',
      params: {
        fiat: normalizedFiat,
        crypto: String(crypto ?? ''),
        fiatAmount: String(fiatAmount ?? ''),
        method,
      },
    });

    const kycLink = await getKycLinkForExistingCustomer({
      endorsement: requiredEndorsement,
      redirectUri: redirectUrl,
    });

    if (!kycLink) throw new Error('Failed to get KYC link');

    startKycFlow({ router, kycLink: kycLink.url, redirectUri: redirectUrl });
  }

  function buildResumeRedirectUri(resume: { pathname: string; params: Record<string, string> }) {
    const baseUrl = process.env.EXPO_PUBLIC_BASE_URL;
    const search = new URLSearchParams(resume.params).toString();
    const uri = `${baseUrl}${resume.pathname}${search ? `?${search}` : ''}`;
    return encodeURIComponent(uri);
  }

  function getEndorsementByMethod(method: BridgeTransferMethod) {
    if (method === BridgeTransferMethod.SEPA) {
      return Endorsements.SEPA;
    } else if (method === BridgeTransferMethod.SPEI) {
      return Endorsements.SPEI;
    } else {
      return Endorsements.BASE;
    }
  }
}
