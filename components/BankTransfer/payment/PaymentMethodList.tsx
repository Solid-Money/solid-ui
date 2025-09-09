import {
  BridgeTransferCryptoCurrency,
  BridgeTransferFiatCurrency,
  BridgeTransferMethod,
  Endorsements,
  EndorsementStatus,
  METHOD_LABEL,
} from '@/components/BankTransfer/enums';
import { Text } from '@/components/ui/text';
import { KycMode } from '@/components/UserKyc';
import { DEPOSIT_MODAL } from '@/constants/modals';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { useCustomer } from '@/hooks/useCustomer';
import { track } from '@/lib/analytics';
import {
  createBridgeTransfer,
  getCustomerEndorsements,
  getKycLinkForExistingCustomer,
} from '@/lib/api';
import { startKycFlow } from '@/lib/utils/kyc';
import { useDepositStore } from '@/store/useDepositStore';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import Toast from 'react-native-toast-message';
import { PaymentMethodTile } from './PaymentMethodTile';

type Props = {
  fiat?: BridgeTransferFiatCurrency;
  crypto?: BridgeTransferCryptoCurrency;
  fiatAmount?: string;
  cryptoAmount?: string;
  isModal?: boolean;
};

const ALL_METHODS: BridgeTransferMethod[] = [
  BridgeTransferMethod.ACH_PUSH,
  BridgeTransferMethod.WIRE,
  BridgeTransferMethod.SEPA,
  BridgeTransferMethod.SPEI,
];

export function PaymentMethodList({ fiat, crypto, fiatAmount, isModal = false }: Props) {
  const normalizedFiat = (fiat || '') as BridgeTransferFiatCurrency;
  const { data: customer, isLoading: isLoadingCustomer } = useCustomer();
  const [loadingMethod, setLoadingMethod] = useState<BridgeTransferMethod | null>(null);
  const { setBankTransferData, setModal } = useDepositStore();

  let filtered: BridgeTransferMethod[] = ALL_METHODS;

  if (normalizedFiat === BridgeTransferFiatCurrency.EUR) {
    filtered = [BridgeTransferMethod.SEPA];
  } else if (normalizedFiat === BridgeTransferFiatCurrency.USD) {
    filtered = [BridgeTransferMethod.ACH_PUSH, BridgeTransferMethod.WIRE];
  }

  if (isLoadingCustomer) {
    return (
      <View className="items-center justify-center py-10 gap-3">
        <ActivityIndicator size="large" color="gray" />
        <Text className="text-muted-foreground">Loading payment methods...</Text>
      </View>
    );
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
      track(TRACKING_EVENTS.PAYMENT_METHOD_SELECTED, {
        method: method,
        fiat_currency: normalizedFiat,
        fiat_amount: fiatAmount,
        has_customer: Boolean(customer),
      });

      setLoadingMethod(method);
      if (!customer) {
        // Store the method selection for modal mode before KYC
        if (isModal) {
          setBankTransferData({ method });

          const redirectUri = buildResumeRedirectUri({
            pathname: '/',
            params: {
              fiat: normalizedFiat,
              crypto: String(crypto ?? ''),
              fiatAmount: String(fiatAmount ?? ''),
              method,
            },
          });

          const endorsement = getEndorsementByMethod(method);

          // Start KYC flow in modal instead of navigating
          const { setKycData, setModal } = useDepositStore.getState();
          setKycData({
            kycMode: KycMode.BANK_TRANSFER,
            endorsement: endorsement,
            redirectUri,
          });

          setModal(DEPOSIT_MODAL.OPEN_BANK_TRANSFER_KYC_INFO);
          return;
        }

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

      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'An error occurred while creating the bridge transfer',
        props: {
          badgeText: '',
        },
      });
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

    if (isModal) {
      setBankTransferData({ instructions: sourceDepositInstructions });
      setModal(DEPOSIT_MODAL.OPEN_BANK_TRANSFER_PREVIEW);
    } else {
      router.push({
        pathname: '/bank-transfer/preview',
        params: {
          instructions: JSON.stringify(sourceDepositInstructions),
        },
      });
    }
  }

  async function startKycFlowForExistingCustomer(
    method: BridgeTransferMethod,
    requiredEndorsement: Endorsements,
  ) {
    // Store the method selection for modal mode before KYC
    if (isModal) {
      setBankTransferData({ method });

      const redirectUrl = buildResumeRedirectUri({
        pathname: '/',
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

      // Start KYC flow in modal instead of navigating
      const { setKycData, setModal } = useDepositStore.getState();
      setKycData({
        kycMode: KycMode.BANK_TRANSFER,
        endorsement: requiredEndorsement,
        redirectUri: redirectUrl,
        kycLink: kycLink.url,
      });

      setModal(DEPOSIT_MODAL.OPEN_BANK_TRANSFER_KYC_FRAME);
      return;
    }

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

    startKycFlow({ router, kycLink: kycLink.url });
  }

  function buildResumeRedirectUri(resume: { pathname: string; params: Record<string, string> }) {
    const baseUrl = process.env.EXPO_PUBLIC_BASE_URL;
    const paramString = Object.entries(resume.params)
      .map(([key, value]) => `${key}:${value}`)
      .join(',');
    const uri = `${baseUrl}${resume.pathname}?resumeParams=${paramString}`;

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
