import { useMemo, useState } from 'react';
import { Linking, Pressable, View } from 'react-native';
import Toast from 'react-native-toast-message';
import { Redirect, useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';

import { CardStatusPage } from '@/components/Card/CardStatusPage';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Text } from '@/components/ui/text';
import { Underline } from '@/components/ui/underline';
import {
  formatUsd,
  INITIAL_DAILY_LIMIT_USD,
  offerableDailyPresets,
  usdToOnChain,
} from '@/constants/cardSpendModule';
import { path } from '@/constants/path';
import { useCardSpendRegistration } from '@/hooks/useCardSpendRegistration';
import { CARD_STATUS_QUERY_KEY, useCardStatus } from '@/hooks/useCardStatus';
import { createCard, submitCardConsents } from '@/lib/api';
import { CardProvider, CardStatus } from '@/lib/types';
import { getActiveCardRoute, hasCard, hasPendingCard, withRefreshToken } from '@/lib/utils';
import { useCardWelcomePopupStore } from '@/store/useCardWelcomePopupStore';
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

/**
 * What the activation button is doing, so the label can say which of its two on-chain
 * steps the user is being asked to approve. A single boolean could not: the second step
 * raises a signature prompt for something the first never mentioned.
 */
type ActivationPhase = 'idle' | 'creating' | 'enabling-spend';

export default function CardReady() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: cardStatusResponse, refetch: refetchCardStatus } = useCardStatus();
  const [activationPhase, setActivationPhase] = useState<ActivationPhase>('idle');
  const [consents, setConsents] = useState<ConsentState>(initialConsents);
  const activating = activationPhase !== 'idle';

  // Read the module state up front, before there is a card to resolve an issuer from —
  // this screen registers the Safe in the same press that creates the card, so waiting
  // for the issuer would mean waiting for the thing that has not happened yet.
  const { registration: spendRegistration, register: registerCardSpending } =
    useCardSpendRegistration({ enabled: true });

  const countryCode = useCountryStore(state => state.countryInfo?.countryCode);
  const setShouldShowWelcomePopup = useCardWelcomePopupStore(
    state => state.setShouldShowWelcomePopup,
  );
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

  /**
   * The daily cap the activation press registers with, or null when the org has no
   * limit open that the module would accept.
   *
   * {@link INITIAL_DAILY_LIMIT_USD} clamped *downwards* to what the org actually allows —
   * never upwards. A ceiling below the default is the org saying this account may not
   * have that much, so the answer is the largest offer underneath it rather than the
   * nearest one; overshooting would only revert with ExceedsOrgDailyCeiling.
   *
   * Falls back to the plain default when the chain read has not landed yet — the mutation
   * re-reads and refuses a limit above the ceilings anyway, so the worst case there is a
   * skipped step, not a failed transaction.
   */
  const initialDailyLimit = useMemo(() => {
    if (!spendRegistration) return INITIAL_DAILY_LIMIT_USD;
    const offerable = offerableDailyPresets(spendRegistration);
    return offerable.filter(dollars => dollars <= INITIAL_DAILY_LIMIT_USD).at(-1) ?? null;
  }, [spendRegistration]);

  // This screen creates the card, and the backend allows exactly one per
  // provider. Re-entering it with a card already in flight (browser back, a deep
  // link, a stale tab) leaves the only button here guaranteed to fail with "card
  // already exists", so route to where that card actually lives instead.
  if (!activating && hasCard(cardStatusResponse)) {
    return <Redirect href={getActiveCardRoute(cardStatusResponse)} />;
  }
  if (!activating && hasPendingCard(cardStatusResponse)) {
    return <Redirect href={path.CARD_ACTIVATE} />;
  }

  /**
   * Enable `SolidCashModule` on the Safe with the smallest daily limit, as part of the
   * same press that created the card.
   *
   * A Wirex card holds no balance — it spends from the user's Safe — so a card without
   * this module is a card that declines everything. Splitting it into a second visit and
   * a second signature is what left cardholders with a card they could not use, so it
   * rides along here.
   *
   * Deliberately best-effort: the card already exists at this point, and there is a
   * setup action on the card screen. A failed or dismissed signature must not read as a
   * failed activation, because the card is genuinely there either way.
   */
  const enableCardSpending = async () => {
    if (initialDailyLimit === null || spendRegistration?.registered) return;

    const explainSetupIsPending = () =>
      Toast.show({
        type: 'info',
        text1: 'Finish setting up card spending',
        text2: 'Your card is ready — open it and tap Set up to let it spend from savings.',
        props: { badgeText: '' },
      });

    try {
      setActivationPhase('enabling-spend');
      // False means the signature prompt was dismissed: nothing was granted, so the card
      // cannot spend yet and the user has to be told where to finish.
      if (!(await registerCardSpending(initialDailyLimit, 'card_activation'))) {
        explainSetupIsPending();
      }
    } catch (error) {
      console.error('Error enabling card spending during activation:', error);
      explainSetupIsPending();
    }
  };

  const handleActivateCard = async () => {
    if (!allAccepted) return;

    try {
      setActivationPhase('creating');

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

      // Show the welcome popup whenever the card lands, including when it opens a
      // moment later on the issuance flow.
      setShouldShowWelcomePopup(true);

      // Read the issuer off the row the card was just written to, rather than the
      // pre-press copy in `cardStatusResponse`. `createCard` does not report a provider,
      // and `resolveCardIssuer` cannot help here either — it only names an issuer for an
      // active card, and a fresh Wirex card sits at PENDING for the first few seconds.
      const { data: refreshedStatus } = await refetchCardStatus();
      if (refreshedStatus?.provider === CardProvider.WIREX) {
        await enableCardSpending();
      }

      if (card.status !== CardStatus.PENDING) {
        // BD users land on the issuance flow to complete the minimum-deposit
        // step before reaching card details; everyone else goes to details.
        router.replace(getActiveCardRoute(cardStatusResponse));
        return;
      }

      // The card exists but the issuer hasn't opened it yet. Leaving the user on
      // this screen was a dead end: the consents are already submitted and the
      // card is already created, so the only button here now fails with "card
      // already exists", and nothing on the page ever notices the card going
      // live. The issuance flow shows the "on its way" state, polls card status,
      // and forwards to the card details page the moment it opens.
      Toast.show({
        type: 'success',
        text1: 'Card creation in progress',
        text2: "We're finishing up your card — this page will update itself.",
        props: { badgeText: '' },
      });
      router.replace(path.CARD_ACTIVATE);
    } catch (error) {
      console.error('Error activating card:', error);
      Toast.show({
        type: 'error',
        text1: 'Error activating card',
        text2: error instanceof Error ? error.message : 'Something went wrong. Please try again.',
        props: { badgeText: '' },
      });
    } finally {
      setActivationPhase('idle');
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
          {activationPhase === 'enabling-spend'
            ? 'Enabling card spending...'
            : activating
              ? 'Activating...'
              : 'Activate card'}
        </Text>
      </Button>

      {/* Shown only once the card exists and its issuer turns out to be the one that
          spends from savings — that is the first moment this is true rather than a guess,
          and it is the moment the signature prompt appears. Saying it up front would mean
          telling every applicant about a grant most of them will never be asked for. */}
      {activationPhase === 'enabling-spend' && initialDailyLimit !== null ? (
        <Text className="mt-3 text-center text-xs leading-snug text-[#ACACAC]">
          Approve the signature to let your card spend from your savings, up to{' '}
          {formatUsd(usdToOnChain(initialDailyLimit))} a day. You can change that limit or turn
          spending off any time from your card.
        </Text>
      ) : null}
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
