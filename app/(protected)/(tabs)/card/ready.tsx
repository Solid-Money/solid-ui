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
import { activationDailyLimit, formatUsd, usdToOnChain } from '@/constants/cardSpendModule';
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
 * What the activation button is doing, so the label can name the step in front of the
 * user. A single boolean could not: one of the steps raises a signature prompt, and
 * "Activating..." over a passkey sheet says nothing about what is being signed.
 */
type ActivationPhase = 'idle' | 'enabling-spend' | 'creating';

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
  const {
    registration: spendRegistration,
    isRegistered: isSpendRegistered,
    register: registerCardSpending,
    refetch: refetchSpendRegistration,
  } = useCardSpendRegistration({ enabled: true });

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
   * The daily cap this activation would register with, for the copy under the button.
   * Null once the ceilings are known to leave nothing offerable.
   *
   * Only what the screen *says*: the press re-reads the ceilings and clamps against
   * those, so a stale copy here can never become the number that is signed.
   */
  const initialDailyLimit = useMemo(
    () => activationDailyLimit(spendRegistration),
    [spendRegistration],
  );

  /**
   * Whether this applicant's card spends from their Safe — answerable before any card
   * exists, which is what lets the on-chain grant run before issuance rather than after.
   *
   * `/cards/status` names the issuer from the card-customer record KYC wrote, so it is
   * set from KYC onward. `resolveCardIssuer` deliberately cannot help here: it reports no
   * issuer until a card is active, and a fresh Wirex card sits at PENDING for the first
   * few seconds.
   */
  const isWirexApplicant = cardStatusResponse?.provider === CardProvider.WIREX;

  /** A Wirex card declines every payment until the Safe is registered, so activation waits. */
  const needsSpendSetup = isWirexApplicant && !isSpendRegistered;

  /**
   * The org has no daily limit this Safe could be registered with, so there is nothing to
   * grant — and for a card that spends from savings, nothing to grant means nothing worth
   * issuing. A disabled button saying so beats a card that declines at the till.
   */
  const spendSetupUnavailable = needsSpendSetup && initialDailyLimit === null;

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
   * Enable `SolidCashModule` on the Safe and register its spending limits — before any
   * card exists. Resolves true only once the Safe can actually be debited.
   *
   * A Wirex card holds no balance: Wirex pays the merchant and our backend debits the
   * Safe afterwards, so a card without this module is a card that declines everything.
   * This used to run *after* `createCard` and swallow both of its failure modes, which
   * meant a dismissed passkey prompt or a reverted user operation left the user holding
   * exactly that card — and there is no way back from it, because `createCard` cannot be
   * undone and the backend allows one card per provider. So the grant is the gate now:
   * false here means nothing was created and the only cost is pressing the button again.
   */
  const grantCardSpending = async (): Promise<boolean> => {
    try {
      setActivationPhase('enabling-spend');

      // Read the chain rather than trust the mount-time copy. It decides two things that
      // both revert if they are wrong — which cap is inside the live org ceilings, and
      // whether there is anything left to sign at all. The second matters most on a
      // *second* press: a user operation that timed out here can still be mined, and
      // sending `registerSafe` at an already registered Safe reverts `AlreadyRegistered`,
      // which under this ordering would leave the applicant with no card at all.
      const limits = (await refetchSpendRegistration()).data ?? spendRegistration ?? null;

      // Already granted — an earlier attempt that landed, or the sheet on another device.
      // Nothing to sign, and the card can be created.
      if (limits?.registered) return true;

      const dailyLimit = activationDailyLimit(limits);
      if (dailyLimit === null) {
        Toast.show({
          type: 'error',
          text1: 'Card spending is not open yet',
          text2:
            'Your card spends straight from savings, and no spending limit is available on your account right now. Please contact support.',
          props: { badgeText: '' },
        });
        return false;
      }

      // False means the signature prompt was dismissed. That is a decision, not a
      // failure, so it is stated plainly — and it costs nothing, because no consents were
      // filed and no card was created.
      if (!(await registerCardSpending(dailyLimit, 'card_activation'))) {
        Toast.show({
          type: 'info',
          text1: 'Card not activated',
          text2:
            'Your card spends from your savings, so it is only created once you approve that signature. Nothing was created — tap Activate card to try again.',
          props: { badgeText: '' },
        });
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error enabling card spending during activation:', error);

      // The chain gets the last word before this is called a failure. Waiting for a
      // receipt times out well before a user operation is truly dead, so the grant this
      // just gave up on may have been mined anyway — and refusing to issue the card in
      // that state would be refusing it for work that is already done.
      try {
        if ((await refetchSpendRegistration()).data?.registered) return true;
      } catch {
        // The read failed too; fall through and report the original failure.
      }

      Toast.show({
        type: 'error',
        text1: 'Card not activated',
        text2: `${
          error instanceof Error ? error.message : 'Something went wrong'
        } — no card was created, please try again.`,
        props: { badgeText: '' },
      });
      return false;
    }
  };

  const handleActivateCard = async () => {
    if (!allAccepted) return;

    try {
      setActivationPhase('creating');

      // Settle the issuer before anything is created: it decides whether this activation
      // carries an on-chain grant, and that ordering is the whole point — a card issued
      // first cannot be un-issued if the grant then fails. The status response names the
      // issuer from KYC onward, so only a copy that has not landed pays for the re-read.
      const provider = cardStatusResponse?.provider ?? (await refetchCardStatus()).data?.provider;

      // The Safe has to be debitable before the card exists, so a dismissed prompt or a
      // dropped user operation ends the press here — with no consents filed, no card, and
      // the button ready to be pressed again — instead of leaving a card that declines
      // every payment behind a toast the user may never see.
      if (provider === CardProvider.WIREX && !isSpendRegistered) {
        if (!(await grantCardSpending())) return;
        setActivationPhase('creating');
      }

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
        disabled={activating || !allAccepted || spendSetupUnavailable}
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

      {/* Said before the press rather than during it. The grant is now what the card is
          issued on, so a user who would rather not make it should be able to decide that
          without a passkey sheet already open — and the issuer is known from their KYC
          record, so only applicants who will actually be asked are told about it. */}
      {needsSpendSetup && initialDailyLimit !== null ? (
        <Text className="mt-3 text-center text-xs leading-snug text-[#ACACAC]">
          {activationPhase === 'enabling-spend'
            ? `Approve the signature to let your card spend from your savings, up to ${formatUsd(
                usdToOnChain(initialDailyLimit),
              )} a day.`
            : `Your card spends straight from your savings, so activating asks for one signature: it lets the card spend up to ${formatUsd(
                usdToOnChain(initialDailyLimit),
              )} a day. You can change that limit or turn spending off any time from your card.`}
        </Text>
      ) : null}

      {/* No limit the module would accept, so there is no grant to make and a card issued
          now would decline every payment. Better to say so than to hand over one. */}
      {spendSetupUnavailable ? (
        <Text className="mt-3 text-center text-xs leading-snug text-[#E8A33D]">
          Card spending limits are not open on your account yet, and your card spends straight from
          savings — so it cannot be activated right now. Please try again later or contact support.
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
