import { useMemo, useState } from 'react';
import { Linking, Pressable, View } from 'react-native';
import Toast from 'react-native-toast-message';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';

import { CardStatusPage } from '@/components/Card/CardStatusPage';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Text } from '@/components/ui/text';
import { Underline } from '@/components/ui/underline';
import { path } from '@/constants/path';
import { CARD_STATUS_QUERY_KEY } from '@/hooks/useCardStatus';
import { createCard, submitCardConsents } from '@/lib/api';
import { CardStatus } from '@/lib/types';
import { withRefreshToken } from '@/lib/utils';
import { useCountryStore } from '@/store/useCountryStore';

type ConsentKey =
  | 'agreedToEsign'
  | 'agreedToAccountOpeningPrivacy'
  | 'isTermsOfServiceAccepted'
  | 'agreedToCertify'
  | 'agreedToNoSolicitation';

type ConsentState = Record<ConsentKey, boolean>;

const initialConsents: ConsentState = {
  agreedToEsign: false,
  agreedToAccountOpeningPrivacy: false,
  isTermsOfServiceAccepted: false,
  agreedToCertify: false,
  agreedToNoSolicitation: false,
};

const ESIGN_CONSENT_URL =
  'https://support.solid.xyz/en/articles/14167249-e-sign-electronic-communications-notice';
const ACCOUNT_OPENING_PRIVACY_URL =
  'https://support.solid.xyz/en/articles/14285527-account-opening-privacy-notice-fuse-network-lt-solid-xyz';
const US_CARD_TERMS_URL =
  'https://support.solid.xyz/en/articles/14285503-fuse-network-ltd-card-terms-for-u-s-consumer-program';
const INTL_CARD_TERMS_URL =
  'https://support.solid.xyz/en/articles/14167076-card-terms-for-international-consumer-program';
const ISSUER_PRIVACY_URL = 'https://www.third-national.com/privacypolicy';

const underlineProps = {
  textClassName: 'text-sm font-bold text-white' as const,
  borderColor: 'rgba(255, 255, 255, 1)' as const,
};

export default function CardReady() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [activating, setActivating] = useState(false);
  const [consents, setConsents] = useState<ConsentState>(initialConsents);

  const countryCode = useCountryStore(state => state.countryInfo?.countryCode);
  const isUS = countryCode?.toUpperCase() === 'US';
  const cardTermsUrl = isUS ? US_CARD_TERMS_URL : INTL_CARD_TERMS_URL;

  const requiredKeys = useMemo<ConsentKey[]>(
    () =>
      isUS
        ? [
            'agreedToEsign',
            'agreedToAccountOpeningPrivacy',
            'isTermsOfServiceAccepted',
            'agreedToCertify',
            'agreedToNoSolicitation',
          ]
        : [
            'agreedToEsign',
            'isTermsOfServiceAccepted',
            'agreedToCertify',
            'agreedToNoSolicitation',
          ],
    [isUS],
  );

  const allAccepted = useMemo(
    () => requiredKeys.every(key => consents[key]),
    [requiredKeys, consents],
  );

  const toggle = (key: ConsentKey) => setConsents(prev => ({ ...prev, [key]: !prev[key] }));

  const handleActivateCard = async () => {
    if (!allAccepted) return;

    try {
      setActivating(true);

      await withRefreshToken(() =>
        submitCardConsents({
          ...consents,
          // Non-US users never see this consent; send false so the field is always present.
          agreedToAccountOpeningPrivacy: isUS ? consents.agreedToAccountOpeningPrivacy : false,
        }),
      );

      const card = await withRefreshToken(() => createCard());
      if (!card) throw new Error('Failed to create card');

      queryClient.invalidateQueries({ queryKey: [CARD_STATUS_QUERY_KEY] });

      if (card.status !== CardStatus.PENDING) {
        router.replace(path.CARD_DETAILS);
      } else {
        Toast.show({
          type: 'success',
          text1: 'Card activation in progress',
          text2: 'Your card is being set up. Please wait.',
          props: { badgeText: '' },
        });
      }
    } catch (error) {
      console.error('Error activating card:', error);
      Toast.show({
        type: 'error',
        text1: 'Error activating card',
        text2: error instanceof Error ? error.message : 'Something went wrong. Please try again.',
        props: { badgeText: '' },
      });
    } finally {
      setActivating(false);
    }
  };

  return (
    <CardStatusPage title="Your card is ready!">
      <View className="mt-4 w-full gap-3">
        <ConsentRow checked={consents.agreedToEsign} onToggle={() => toggle('agreedToEsign')}>
          I accept the{' '}
          <Underline inline {...underlineProps} onPress={() => Linking.openURL(ESIGN_CONSENT_URL)}>
            E-Sign Consent
          </Underline>
          .
        </ConsentRow>

        {isUS && (
          <ConsentRow
            checked={consents.agreedToAccountOpeningPrivacy}
            onToggle={() => toggle('agreedToAccountOpeningPrivacy')}
          >
            I accept the{' '}
            <Underline
              inline
              {...underlineProps}
              onPress={() => Linking.openURL(ACCOUNT_OPENING_PRIVACY_URL)}
            >
              Account Opening Privacy Notice
            </Underline>
            .
          </ConsentRow>
        )}

        <ConsentRow
          checked={consents.isTermsOfServiceAccepted}
          onToggle={() => toggle('isTermsOfServiceAccepted')}
        >
          I accept the{' '}
          <Underline inline {...underlineProps} onPress={() => Linking.openURL(cardTermsUrl)}>
            Solid Card Terms
          </Underline>{' '}
          and the{' '}
          <Underline inline {...underlineProps} onPress={() => Linking.openURL(ISSUER_PRIVACY_URL)}>
            Issuer Privacy Policy
          </Underline>
          .
        </ConsentRow>

        <ConsentRow checked={consents.agreedToCertify} onToggle={() => toggle('agreedToCertify')}>
          I certify that the information I have provided is accurate and that I will abide by all
          the rules and requirements related to my Solid Spend Card.
        </ConsentRow>

        <ConsentRow
          checked={consents.agreedToNoSolicitation}
          onToggle={() => toggle('agreedToNoSolicitation')}
        >
          I acknowledge that applying for the Solid Spend Card does not constitute unauthorized
          solicitation.
        </ConsentRow>
      </View>

      <Button
        variant="brand"
        onPress={handleActivateCard}
        disabled={activating || !allAccepted}
        className="mt-6 h-12 w-full rounded-xl"
      >
        <Text className="text-base font-bold text-primary-foreground">
          {activating ? 'Activating...' : 'Activate card'}
        </Text>
      </Button>
    </CardStatusPage>
  );
}

function ConsentRow({
  checked,
  onToggle,
  children,
}: {
  checked: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <View className="w-full flex-row items-start">
      <Checkbox checked={checked} onCheckedChange={onToggle} className="mr-3 mt-0.5" />
      <Pressable onPress={onToggle} className="flex-1">
        <Text className="text-left text-sm leading-5 text-[#ACACAC]">{children}</Text>
      </Pressable>
    </View>
  );
}
