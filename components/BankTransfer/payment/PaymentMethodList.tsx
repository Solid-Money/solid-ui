import { useRef, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import Toast from 'react-native-toast-message';
import { router } from 'expo-router';
import { useShallow } from 'zustand/react/shallow';

import {
  BridgeTransferCryptoCurrency,
  BridgeTransferFiatCurrency,
  BridgeTransferMethod,
  Endorsements,
  EndorsementStatus,
  METHOD_LABEL,
  METHOD_SUBTITLE,
} from '@/components/BankTransfer/enums';
import { Text } from '@/components/ui/text';
import { KycMode } from '@/components/UserKyc';
import { DEPOSIT_MODAL } from '@/constants/modals';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { useCustomer } from '@/hooks/useCustomer';
import useUser from '@/hooks/useUser';
import { track } from '@/lib/analytics';
import {
  createBridgeTransfer,
  getCustomerEndorsements,
  getKycLinkForExistingCustomer,
} from '@/lib/api';
import { startKycFlow } from '@/lib/utils/kyc';
import { useDepositStore } from '@/store/useDepositStore';

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
  BridgeTransferMethod.PIX,
  BridgeTransferMethod.FPS,
];

export function PaymentMethodList({ fiat, crypto, fiatAmount, isModal = false }: Props) {
  const normalizedFiat = (fiat || '') as BridgeTransferFiatCurrency;
  const { data: customer, isLoading: isLoadingCustomer } = useCustomer();
  const [loadingMethod, setLoadingMethod] = useState<BridgeTransferMethod | null>(null);
  const { setBankTransferData, setModal } = useDepositStore(
    useShallow(state => ({
      setBankTransferData: state.setBankTransferData,
      setModal: state.setModal,
    })),
  );
  const { user } = useUser();
  const methodSelectionStartTime = useRef<number | null>(null);

  let filtered: BridgeTransferMethod[] = ALL_METHODS;

  if (normalizedFiat === BridgeTransferFiatCurrency.EUR) {
    filtered = [BridgeTransferMethod.SEPA];
  } else if (normalizedFiat === BridgeTransferFiatCurrency.USD) {
    filtered = [BridgeTransferMethod.ACH_PUSH, BridgeTransferMethod.WIRE];
  } else if (normalizedFiat === BridgeTransferFiatCurrency.MXN) {
    filtered = [BridgeTransferMethod.SPEI];
  } else if (normalizedFiat === BridgeTransferFiatCurrency.BRL) {
    filtered = [BridgeTransferMethod.PIX];
  } else if (normalizedFiat === BridgeTransferFiatCurrency.GBP) {
    filtered = [BridgeTransferMethod.FPS];
  }

  if (isLoadingCustomer) {
    return (
      <View className="items-center justify-center gap-3 py-10">
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
          subtitle={METHOD_SUBTITLE[method]}
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
      // Capture start time for time_to_create calculation
      methodSelectionStartTime.current = Date.now();

      track(TRACKING_EVENTS.PAYMENT_METHOD_SELECTED, {
        user_id: user?.userId,
        safe_address: user?.safeAddress,
        method: method,
        fiat_currency: normalizedFiat,
        fiat_amount: fiatAmount,
        crypto_currency: crypto,
        has_customer: Boolean(customer),
        requires_kyc: !customer,
        deposit_type: 'bank_transfer',
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

          // Track KYC modal viewed for new customer
          track(TRACKING_EVENTS.DEPOSIT_BANK_KYC_VIEWED, {
            deposit_method: 'bank_transfer',
            payment_method: method,
            fiat_currency: normalizedFiat,
            fiat_amount: fiatAmount,
            kyc_type: 'new_customer',
            kyc_endorsement: endorsement,
          });

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

      // Try to extract user-friendly error message from API response
      let errorMessage = 'An error occurred while creating the transfer';
      let errorCode = 'Unknown error';

      try {
        if (err instanceof Response) {
          const errorData = await err.json();
          errorCode = errorData.code || errorData.error || 'api_error';

          // Backend returns user-friendly message in errorData.message
          if (errorData?.message) {
            errorMessage = errorData.message;
          }
        }
      } catch {
        // Failed to parse error response, use default message
      }

      // Track bank transfer error
      track(TRACKING_EVENTS.DEPOSIT_ERROR, {
        user_id: user?.userId,
        safe_address: user?.safeAddress,
        amount: fiatAmount,
        fiat_currency: normalizedFiat,
        crypto_currency: crypto,
        deposit_type: 'bank_transfer',
        deposit_method: loadingMethod,
        errorMessage: errorMessage,
        error: errorCode,
      });

      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: errorMessage,
        props: {
          badgeText: '',
        },
      });
    } finally {
      setLoadingMethod(null);
    }
  }

  async function createTransfer(method: BridgeTransferMethod) {
    // Track bank transfer initiated
    track(TRACKING_EVENTS.DEPOSIT_INITIATED, {
      user_id: user?.userId,
      safe_address: user?.safeAddress,
      amount: fiatAmount,
      fiat_currency: normalizedFiat,
      crypto_currency: crypto,
      deposit_type: 'bank_transfer',
      deposit_method: method,
      has_customer: Boolean(customer),
    });

    const sourceDepositInstructions = await createBridgeTransfer({
      amount: String(fiatAmount ?? ''),
      sourcePaymentRail: method,
      fiatCurrency: normalizedFiat,
      cryptoCurrency: String(crypto ?? ''),
    });

    // Calculate time from method selection to transfer creation
    const timeToCreate = methodSelectionStartTime.current
      ? Math.floor((Date.now() - methodSelectionStartTime.current) / 1000)
      : undefined;

    // Track bank transfer created successfully
    track(TRACKING_EVENTS.BANK_TRANSFER_CREATED, {
      user_id: user?.userId,
      safe_address: user?.safeAddress,
      amount: fiatAmount,
      fiat_currency: normalizedFiat,
      crypto_currency: crypto,
      deposit_type: 'bank_transfer',
      deposit_method: method,
      has_instructions: Boolean(sourceDepositInstructions),
      time_to_create: timeToCreate,
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

      // Track KYC modal viewed for existing customer
      track(TRACKING_EVENTS.DEPOSIT_BANK_KYC_VIEWED, {
        deposit_method: 'bank_transfer',
        payment_method: method,
        fiat_currency: normalizedFiat,
        fiat_amount: fiatAmount,
        kyc_type: 'existing_customer',
        kyc_endorsement: requiredEndorsement,
      });

      // Track KYC started when link is opened
      track(TRACKING_EVENTS.DEPOSIT_BANK_KYC_STARTED, {
        deposit_method: 'bank_transfer',
        payment_method: method,
        fiat_currency: normalizedFiat,
        fiat_amount: fiatAmount,
        kyc_type: 'existing_customer',
        kyc_endorsement: requiredEndorsement,
        kyc_link: kycLink.url,
      });

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
    } else if (method === BridgeTransferMethod.PIX) {
      return Endorsements.PIX;
    } else if (method === BridgeTransferMethod.FPS) {
      return Endorsements.FASTER_PAYMENTS;
    } else {
      return Endorsements.BASE;
    }
  }
}
