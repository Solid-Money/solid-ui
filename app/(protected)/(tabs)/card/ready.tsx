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
import { EXPO_PUBLIC_BASE_URL } from '@/lib/config';
import { CardStatus } from '@/lib/types';
import { withRefreshToken } from '@/lib/utils';

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

const underlineProps = {
  textClassName: 'text-sm font-bold text-white' as const,
  borderColor: 'rgba(255, 255, 255, 1)' as const,
};

export default function CardReady() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [activating, setActivating] = useState(false);
  const [consents, setConsents] = useState<ConsentState>(initialConsents);

  const baseUrl = EXPO_PUBLIC_BASE_URL || 'https://solid.xyz';

  const allAccepted = useMemo(
    () => (Object.keys(consents) as ConsentKey[]).every(key => consents[key]),
    [consents],
  );

  const toggle = (key: ConsentKey) => setConsents(prev => ({ ...prev, [key]: !prev[key] }));

  const handleActivateCard = async () => {
    if (!allAccepted) return;

    try {
      setActivating(true);

      await withRefreshToken(() => submitCardConsents(consents));

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
          <Underline
            inline
            {...underlineProps}
            onPress={() => Linking.openURL(`${baseUrl}/legal/esign-consent`)}
          >
            E-Sign Consent
          </Underline>
          .
        </ConsentRow>

        <ConsentRow
          checked={consents.agreedToAccountOpeningPrivacy}
          onToggle={() => toggle('agreedToAccountOpeningPrivacy')}
        >
          I accept the{' '}
          <Underline
            inline
            {...underlineProps}
            onPress={() => Linking.openURL(`${baseUrl}/legal/account-opening-privacy`)}
          >
            Account Opening Privacy Notice
          </Underline>
          .
        </ConsentRow>

        <ConsentRow
          checked={consents.isTermsOfServiceAccepted}
          onToggle={() => toggle('isTermsOfServiceAccepted')}
        >
          I accept the{' '}
          <Underline
            inline
            {...underlineProps}
            onPress={() => Linking.openURL(`${baseUrl}/legal/card-terms`)}
          >
            Solid Card Terms
          </Underline>{' '}
          and the{' '}
          <Underline
            inline
            {...underlineProps}
            onPress={() => Linking.openURL(`${baseUrl}/legal/issuer-privacy`)}
          >
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
