import { useMemo, useState } from 'react';
import { Linking, Pressable, View } from 'react-native';

import { Checkbox } from '@/components/ui/checkbox';
import { Text } from '@/components/ui/text';
import { Underline } from '@/components/ui/underline';
import { openHelpLink } from '@/lib/help/links';

export type ConsentKey =
  | 'agreedToEsign'
  | 'agreedToAccountOpeningPrivacy'
  | 'isTermsOfServiceAccepted'
  | 'agreedToCertify'
  | 'agreedToNoSolicitation';

export type ConsentState = Record<ConsentKey, boolean>;

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

/**
 * The card consents and whether all the ones this applicant must give are given. US applicants
 * also accept the Account Opening Privacy Notice; nobody else is shown it.
 */
export function useCardConsents(isUS: boolean) {
  // Answers belong to the jurisdiction (isUS) they were given under. isUS can flip while mounted
  // — the KYC country can resolve after the picked one — so start over on a change, or acceptance
  // (including the Terms, whose link changes with isUS) carries into a jurisdiction the applicant
  // never saw.
  const [answers, setAnswers] = useState<{ isUS: boolean; consents: ConsentState }>({
    isUS,
    consents: initialConsents,
  });
  const consents = answers.isUS === isUS ? answers.consents : initialConsents;

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

  const toggle = (key: ConsentKey) =>
    setAnswers(prev => {
      const current = prev.isUS === isUS ? prev.consents : initialConsents;
      return { isUS, consents: { ...current, [key]: !current[key] } };
    });

  /** What `submitCardConsents` is sent. */
  const submission = {
    ...consents,
    // Non-US users never see this consent; send false so the field is always present.
    agreedToAccountOpeningPrivacy: isUS ? consents.agreedToAccountOpeningPrivacy : false,
  };

  return { consents, toggle, allAccepted, submission };
}

/** The consent checkboxes, as the card ready screen has always shown them. */
export function CardConsentList({
  consents,
  onToggle,
  isUS,
}: {
  consents: ConsentState;
  onToggle: (key: ConsentKey) => void;
  isUS: boolean;
}) {
  const cardTermsUrl = isUS ? US_CARD_TERMS_URL : INTL_CARD_TERMS_URL;

  return (
    <>
      <ConsentRow checked={consents.agreedToEsign} onToggle={() => onToggle('agreedToEsign')}>
        I accept the{' '}
        <Underline inline {...underlineProps} onPress={() => openHelpLink(ESIGN_CONSENT_URL)}>
          E-Sign Consent
        </Underline>
        .
      </ConsentRow>

      {isUS && (
        <ConsentRow
          checked={consents.agreedToAccountOpeningPrivacy}
          onToggle={() => onToggle('agreedToAccountOpeningPrivacy')}
        >
          I accept the{' '}
          <Underline
            inline
            {...underlineProps}
            onPress={() => openHelpLink(ACCOUNT_OPENING_PRIVACY_URL)}
          >
            Account Opening Privacy Notice
          </Underline>
          .
        </ConsentRow>
      )}

      <ConsentRow
        checked={consents.isTermsOfServiceAccepted}
        onToggle={() => onToggle('isTermsOfServiceAccepted')}
      >
        I accept the{' '}
        <Underline inline {...underlineProps} onPress={() => openHelpLink(cardTermsUrl)}>
          Solid Card Terms
        </Underline>{' '}
        and the{' '}
        <Underline inline {...underlineProps} onPress={() => Linking.openURL(ISSUER_PRIVACY_URL)}>
          Issuer Privacy Policy
        </Underline>
        .
      </ConsentRow>

      <ConsentRow checked={consents.agreedToCertify} onToggle={() => onToggle('agreedToCertify')}>
        I certify that the information I have provided is accurate and that I will abide by all the
        rules and requirements related to my Solid Spend Card.
      </ConsentRow>

      <ConsentRow
        checked={consents.agreedToNoSolicitation}
        onToggle={() => onToggle('agreedToNoSolicitation')}
      >
        I acknowledge that applying for the Solid Spend Card does not constitute unauthorized
        solicitation.
      </ConsentRow>
    </>
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
