import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import Toast from 'react-native-toast-message';
import { Redirect, useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';

import { CardConsentList, useCardConsents } from '@/components/Card/CardConsents';
import { CardStatusPanel } from '@/components/Card/CardStatusPage';
import { FlagEuIcon, FlagUsIcon } from '@/components/Card/MainCurrency/icons';
import { MAIN_CURRENCY_LABEL } from '@/components/Card/MainCurrency/mainCurrencyCopy';
import { CardCurrencySheet } from '@/components/Card/WirexOnboarding/CardCurrencySheet';
import {
  ActivationItem,
  ActivationItemState,
  WirexActivating,
} from '@/components/Card/WirexOnboarding/WirexActivating';
import {
  CardWaitingHero,
  WirexOnboardingLayout,
} from '@/components/Card/WirexOnboarding/WirexOnboardingLayout';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { activationDailyLimit, formatUsd, usdToOnChain } from '@/constants/cardSpendModule';
import { COUNTRIES } from '@/constants/countries';
import { path } from '@/constants/path';
import {
  BASE_SPEND_DEPLOYMENT,
  isSpendDeploymentConfigured,
} from '@/constants/spendModuleDeployments';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { useCardSpendRegistration } from '@/hooks/useCardSpendRegistration';
import { CARD_STATUS_QUERY_KEY, useCardStatus } from '@/hooks/useCardStatus';
import { useCardSpendDeployments, useEuroSpendEnablement } from '@/hooks/useEuroSpendEnablement';
import { useMainCurrency } from '@/hooks/useMainCurrency';
import useUser from '@/hooks/useUser';
import { WALLET_ELIGIBILITY_KEY } from '@/hooks/useWalletEligibility';
import { track } from '@/lib/analytics';
import { createCard, submitCardConsents } from '@/lib/api';
import { showErrorToast } from '@/lib/errors';
import { CardStatus, KycStatus, MainCurrency } from '@/lib/types';
import { getActiveCardRoute, hasCard, hasPendingCard, withRefreshToken } from '@/lib/utils';
import { suggestedCardCurrency } from '@/lib/utils/wirexOnboarding';
import { useCardWelcomePopupStore } from '@/store/useCardWelcomePopupStore';
import { useCountryStore } from '@/store/useCountryStore';

import type { PasskeyBatchParticipant, PasskeySignatureBatch } from '@/lib/passkeySignatureBatch';

/** How one approval ended. `failed` carries the error for the toast. */
type GrantOutcome =
  | { status: 'done' }
  | { status: 'cancelled' }
  | { status: 'unavailable' }
  | { status: 'failed'; error: unknown };

interface ActivationProgress {
  card: ActivationItemState;
  /** Only when euro was picked. */
  euro?: ActivationItemState;
  create: ActivationItemState;
}

const DONE: GrantOutcome = { status: 'done' };

/** The flags are 40pt; the currency row draws them at the design's 32. */
const CurrencyFlag = ({ currency }: { currency: MainCurrency }) => (
  <View style={{ width: 32, height: 32, alignItems: 'center', justifyContent: 'center' }}>
    <View style={{ transform: [{ scale: 0.8 }] }}>
      {currency === 'EUR' ? <FlagEuIcon /> : <FlagUsIcon />}
    </View>
  </View>
);

/**
 * "You're approved!" (Figma 5 · Approved → activate) and the activation behind its button.
 *
 * The card currency is picked here, right before the passkey, instead of before KYC:
 * preselected by country (Euro in the euro area), changed from a sheet of the Main currency
 * option cards, and saved at activation as the Main currency.
 *
 * Activate runs, from one tap:
 *  1. the card approval on Fuse (`useCardSpendRegistration`) — the Safe the card spends from;
 *  2. with Euro, the euro approval on Base (`useEuroSpendEnablement`) — so the card pays with EURC;
 *  3. the consents, the Main currency, and the card itself.
 * With Euro, 1 and 2 are signed with ONE passkey prompt (see `createSignatureBatch`). With US
 * dollar there is no euro approval at all: until now every Wirex applicant was asked for both.
 *
 * Both approvals gate the card, as they always have: nothing is created unless both landed, and a
 * second press only asks for the half that is missing.
 */
export function WirexCardApproval() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: cardStatusResponse } = useCardStatus();
  const { createSignatureBatch } = useUser();

  const {
    registration: spendRegistration,
    isRegistered: isSpendRegistered,
    register: registerCardSpending,
    refetch: refetchSpendRegistration,
  } = useCardSpendRegistration({ enabled: true });
  const euroSpend = useEuroSpendEnablement();
  const { refetch: refetchSpendDeployments } = useCardSpendDeployments();
  const { save: saveMainCurrency } = useMainCurrency();

  const countryInfo = useCountryStore(state => state.countryInfo);
  const setShouldShowWelcomePopup = useCardWelcomePopupStore(
    state => state.setShouldShowWelcomePopup,
  );

  // The residence the KYC established, which is evidenced, before the one the user picked.
  const countryCode = cardStatusResponse?.country ?? countryInfo?.countryCode;
  // Derive US from the same KYC-first country the currency suggestion uses, so the consent set
  // and the currency never disagree when the picked country differs from the one KYC evidenced.
  const isUS = countryCode?.toUpperCase() === 'US';
  const { consents, toggle, allAccepted, submission } = useCardConsents(isUS);

  const countryName = COUNTRIES.find(country => country.code === countryCode?.toUpperCase())?.name;
  const suggested = suggestedCardCurrency(countryCode);

  // Euro needs the Base deployment: this build must have its addresses and the backend must not
  // have switched it off. Without it there is nothing to pick — the card is a dollar card.
  const offersEuro =
    isSpendDeploymentConfigured(BASE_SPEND_DEPLOYMENT) && euroSpend.deployment?.available !== false;
  const [picked, setPicked] = useState<MainCurrency>();
  const currency: MainCurrency = offersEuro ? (picked ?? suggested) : 'USD';
  const [isCurrencySheetOpen, setIsCurrencySheetOpen] = useState(false);

  const [progress, setProgress] = useState<ActivationProgress | null>(null);
  const activating = progress !== null;

  const initialDailyLimit = useMemo(
    () => activationDailyLimit(spendRegistration),
    [spendRegistration],
  );
  const needsSpendSetup = !isSpendRegistered;
  const needsEuroSetup = currency === 'EUR' && !euroSpend.isEnabled;
  const spendSetupUnavailable = needsSpendSetup && initialDailyLimit === null;

  // Once per visit.
  const hasTrackedViewRef = useRef(false);
  useEffect(() => {
    if (hasTrackedViewRef.current) return;
    hasTrackedViewRef.current = true;
    track(TRACKING_EVENTS.CARD_ONBOARDING_STEP_VIEWED, {
      step: 'approved',
      suggested_currency: suggested,
      offers_euro: offersEuro,
    });
  }, [suggested, offersEuro]);

  // Same guards as the issuance screen: one card per issuer, so a card that exists or is on its
  // way is where this applicant belongs. And only an approved applicant can be issued one.
  if (!activating && hasCard(cardStatusResponse)) {
    return <Redirect href={getActiveCardRoute(cardStatusResponse)} />;
  }
  if (!activating && hasPendingCard(cardStatusResponse)) {
    return <Redirect href={path.CARD_ACTIVATE} />;
  }
  if (!activating && cardStatusResponse && cardStatusResponse.kycStatus !== KycStatus.APPROVED) {
    return <Redirect href={path.CARD_ACTIVATE} />;
  }

  const handlePickCurrency = (next: MainCurrency) => {
    setPicked(next);
    track(TRACKING_EVENTS.CARD_CURRENCY_SELECTED, {
      currency: next,
      suggested,
      is_suggested: next === suggested,
    });
  };

  /** The card approval on Fuse: the Safe the card spends from must be debitable first. */
  const grantCardSpending = async (signer?: PasskeyBatchParticipant): Promise<GrantOutcome> => {
    try {
      // The chain, not the mount-time copy: a second press after a receipt timed out must not
      // send `registerSafe` at a Safe that is already registered.
      const limits = (await refetchSpendRegistration()).data ?? spendRegistration ?? null;
      if (limits?.registered) return DONE;

      const dailyLimit = activationDailyLimit(limits);
      if (dailyLimit === null) return { status: 'unavailable' };

      const registered = await registerCardSpending(dailyLimit, 'card_activation', undefined, {
        signer,
      });
      return registered ? DONE : { status: 'cancelled' };
    } catch (error) {
      console.error('Error enabling card spending during activation:', error);
      // A receipt that timed out can still have been mined: the chain gets the last word.
      try {
        if ((await refetchSpendRegistration()).data?.registered) return DONE;
      } catch {
        // The read failed too; report the original failure.
      }
      return { status: 'failed', error };
    } finally {
      // A no-op once the approval was signed; frees the batch when it never got that far.
      signer?.release();
    }
  };

  /** The euro approval on Base, so the card pays euro shops from EURC. */
  const grantEuroSpending = async (signer?: PasskeyBatchParticipant): Promise<GrantOutcome> => {
    try {
      const enabled = await euroSpend.enableAsync('card_activation', { signer });
      return enabled ? DONE : { status: 'cancelled' };
    } catch (error) {
      console.error('Error enabling EURC spending during activation:', error);
      // A confirm that landed while its response was lost is a finished approval.
      try {
        const { data } = await refetchSpendDeployments();
        const base = data?.deployments.find(
          deployment => deployment.chainId === BASE_SPEND_DEPLOYMENT.chainId,
        );
        if (base?.enabled) return DONE;
      } catch {
        // The read failed too; report the original failure.
      }
      return { status: 'failed', error };
    } finally {
      signer?.release();
    }
  };

  /**
   * Both approvals, signed with one passkey prompt when both are needed. Falls back to one prompt
   * each, one after the other, if the batch cannot be set up — never two prompts at once.
   */
  const grantApprovals = async (): Promise<[GrantOutcome, GrantOutcome]> => {
    const markCard = (outcome: GrantOutcome) => {
      if (outcome.status === 'done') setProgress(prev => prev && { ...prev, card: 'done' });
      return outcome;
    };
    const markEuro = (outcome: GrantOutcome) => {
      if (outcome.status === 'done') setProgress(prev => prev && { ...prev, euro: 'done' });
      return outcome;
    };

    let batch: PasskeySignatureBatch | null = null;
    if (needsSpendSetup && needsEuroSetup) {
      try {
        batch = createSignatureBatch();
      } catch {
        batch = null;
      }
    }

    track(TRACKING_EVENTS.CARD_ACTIVATION_SIGNATURES, {
      approvals: Number(needsSpendSetup) + Number(needsEuroSetup),
      batched: Boolean(batch),
      currency,
    });

    if (batch) {
      const cardSigner = batch.participant();
      const euroSigner = batch.participant();
      return Promise.all([
        grantCardSpending(cardSigner).then(markCard),
        grantEuroSpending(euroSigner).then(markEuro),
      ]);
    }

    const card = needsSpendSetup ? markCard(await grantCardSpending()) : DONE;
    if (card.status !== 'done') return [card, DONE];
    const euro = needsEuroSetup ? markEuro(await grantEuroSpending()) : DONE;
    return [card, euro];
  };

  const handleActivate = async () => {
    if (!allAccepted || activating) return;

    setProgress({
      card: needsSpendSetup ? 'active' : 'done',
      ...(currency === 'EUR' && { euro: needsEuroSetup ? 'active' : 'done' }),
      create: 'pending',
    });

    try {
      const outcomes = await grantApprovals();

      const failed = outcomes.find(
        (outcome): outcome is Extract<GrantOutcome, { status: 'failed' }> =>
          outcome.status === 'failed',
      );
      if (failed) {
        void showErrorToast(failed.error, {
          action: 'card_activate',
          body: 'No card was created. Try again in a moment.',
        });
        return;
      }
      if (outcomes.some(outcome => outcome.status === 'unavailable')) {
        Toast.show({
          type: 'error',
          text1: 'Card spending is not open yet',
          text2:
            'Your card spends straight from savings, and no spending limit is available on your account right now. Please contact support.',
          props: { badgeText: '' },
        });
        return;
      }
      if (outcomes.some(outcome => outcome.status === 'cancelled')) {
        // A decision, not a failure — and it cost nothing: no consents, no card.
        Toast.show({
          type: 'info',
          text1: 'Card not activated',
          text2:
            'Your card is only created once you approve with your passkey. Nothing was created — tap Activate card to try again.',
          props: { badgeText: '' },
        });
        return;
      }

      setProgress(prev => prev && { ...prev, create: 'active' });

      await withRefreshToken(() => submitCardConsents(submission));

      // The currency picked above, saved as the Main currency before the card's first read so the
      // card opens in it. Never a reason to withhold the card: the default is dollars, and Main
      // currency changes it later.
      try {
        await saveMainCurrency(currency);
      } catch (error) {
        console.error('Could not save the card currency at activation:', error);
      }

      const card = await withRefreshToken(() => createCard());
      if (!card) throw new Error('Failed to create card');

      queryClient.invalidateQueries({ queryKey: [CARD_STATUS_QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: [WALLET_ELIGIBILITY_KEY] });

      // The card-live popup, wherever the card lands.
      setShouldShowWelcomePopup(true);

      if (card.status !== CardStatus.PENDING) {
        router.replace(getActiveCardRoute(cardStatusResponse));
        return;
      }

      // Ordered, not opened yet: the onboarding shows the Activating screen with the card in
      // progress and moves on by itself once the issuer opens it.
      router.replace(path.CARD_ACTIVATE);
    } catch (error) {
      console.error('Error activating card:', error);
      queryClient.invalidateQueries({ queryKey: [CARD_STATUS_QUERY_KEY] });
      void showErrorToast(error, { action: 'card_activate' });
    } finally {
      setProgress(null);
    }
  };

  if (progress) {
    const items: ActivationItem[] = [
      { label: 'Turning on your card…', doneLabel: 'Card turned on', state: progress.card },
      ...(progress.euro
        ? [
            {
              label: 'Turning on euro payments…',
              doneLabel: 'Euro payments turned on',
              state: progress.euro,
            },
          ]
        : []),
      { label: 'Creating your card…', state: progress.create },
    ];
    return <WirexActivating items={items} />;
  }

  const limitText = initialDailyLimit !== null ? formatUsd(usdToOnChain(initialDailyLimit)) : null;
  const footnote =
    needsSpendSetup && limitText
      ? needsEuroSetup
        ? `Activating asks for your passkey. It turns on your card (up to ${limitText} a day) and euro payments from your EURC. You can change both anytime from your card.`
        : `Activating asks for your passkey. It turns on your card (up to ${limitText} a day). You can change it anytime from your card.`
      : !needsSpendSetup && needsEuroSetup
        ? 'Activating asks for your passkey. It turns on euro payments from your EURC. You can change it anytime from your card.'
        : null;

  return (
    <WirexOnboardingLayout step={3}>
      <CardStatusPanel title="You’re approved!" image={<CardWaitingHero />}>
        <Text className="mt-4 text-center text-sm text-[#ACACAC]">
          Accept the terms below to activate your Visa card.
        </Text>

        {offersEuro ? (
          <View className="mt-4 h-[60px] w-full flex-row items-center gap-3 rounded-[14px] bg-[#262626] pl-3.5 pr-4">
            <CurrencyFlag currency={currency} />
            <View className="flex-1 gap-px">
              <Text className="text-xs text-[#ACACAC]">Card currency</Text>
              <Text className="text-base font-medium text-white">
                {MAIN_CURRENCY_LABEL[currency]}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Change card currency"
              hitSlop={12}
              onPress={() => setIsCurrencySheetOpen(true)}
              className="web:hover:opacity-70"
            >
              <Text className="text-sm font-medium text-[#94F27F]">Change</Text>
            </Pressable>
          </View>
        ) : null}

        <View className="mt-9 w-full gap-3">
          <CardConsentList consents={consents} onToggle={toggle} isUS={isUS} />
        </View>

        <Button
          variant="brand"
          className="mt-6 w-full"
          onPress={handleActivate}
          disabled={!allAccepted || spendSetupUnavailable}
        >
          <Text>Activate card</Text>
        </Button>

        {footnote ? (
          <Text className="mt-3 text-center text-xs leading-snug text-[#ACACAC]">{footnote}</Text>
        ) : null}

        {/* No limit the module would accept, so a card issued now would decline every payment.
            Better to say so than to hand one over. */}
        {spendSetupUnavailable ? (
          <Text className="mt-3 text-center text-xs leading-snug text-[#E8A33D]">
            Card spending limits are not open on your account yet, and your card spends straight
            from savings — so it cannot be activated right now. Please try again later or contact
            support.
          </Text>
        ) : null}
      </CardStatusPanel>

      <CardCurrencySheet
        isOpen={isCurrencySheetOpen}
        onOpenChange={setIsCurrencySheetOpen}
        selected={currency}
        suggested={suggested}
        countryName={countryName}
        onSelect={handlePickCurrency}
      />
    </WirexOnboardingLayout>
  );
}

export default WirexCardApproval;
