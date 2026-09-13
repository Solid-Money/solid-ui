import { useEffect } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { path } from '@/constants/path';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { useCardStatus } from '@/hooks/useCardStatus';
import { useCardSteps } from '@/hooks/useCardSteps';
import { useCountryCheck } from '@/hooks/useCountryCheck';
import { track } from '@/lib/analytics';
import { CardStatus, KycStatus } from '@/lib/types';
import { hasCard, hasCardStatusWithRainApplication, hasPendingCard } from '@/lib/utils';
import { isCardIssuanceUnderReview } from '@/lib/utils/cardReviewState';
import { isKycAwaitingDecision } from '@/lib/utils/kyc/verificationProgress';

export function useActivateCard() {
  const router = useRouter();

  // Route params
  const {
    kycLink: _kycLink,
    kycStatus: _kycStatus,
    countryConfirmed,
  } = useLocalSearchParams<{
    kycLink?: string;
    kycStatus?: KycStatus;
    countryConfirmed?: string;
  }>();

  // Card status
  const { data: cardStatusResponse, isLoading: isCardStatusLoading } = useCardStatus({
    refetchInterval: 3000,
  });
  const cardStatus = cardStatusResponse?.status;
  const isCardPending = cardStatus === CardStatus.PENDING;
  const isCardBlocked = Boolean(cardStatusResponse?.activationBlocked);
  const activationBlockedReason =
    cardStatusResponse?.activationBlockedReason ||
    'There was an issue activating your card. Please contact support.';

  // Whether verification is in and a decision is pending, for either live
  // issuer — Rain/Didit's application status and the backend kycStatus the
  // Wirex/Sumsub flow reports are folded into one answer upstream.
  const awaitingKycDecision = isKycAwaitingDecision(cardStatusResponse);

  // Country check logic (Rain-first: Bridge-only = no card). Skip when user already has card,
  // has confirmed country, or has Rain application status (already in KYC flow).
  const userHasCard = hasCard(cardStatusResponse);
  const hasRainApplicationStatus = hasCardStatusWithRainApplication(cardStatusResponse);
  // A card already ordered clears the gate too — this screen is where a pending
  // card waits, and re-running an IP check on someone mid-issuance would bounce a
  // traveller (or anyone behind a VPN) into country selection and restart the
  // onboarding they just finished. A submitted verification clears it for the
  // same reason, and needs saying separately: a Wirex/Sumsub applicant has no
  // Rain application for the clause above to catch, so an IP guess could bounce
  // one mid-decision into country selection — which is the "we just show the
  // verify page again" loop this screen exists to end.
  const skipCountryCheck =
    countryConfirmed === 'true' ||
    userHasCard ||
    hasPendingCard(cardStatusResponse) ||
    hasRainApplicationStatus ||
    awaitingKycDecision;
  const { checkingCountry } = useCountryCheck({ skip: skipCountryCheck });
  const isCheckingCountry = !skipCountryCheck && checkingCountry;

  // Card steps
  const {
    steps,
    activeStepId,
    isStepButtonEnabled,
    toggleStep,
    canToggleStep,
    activatingCard,
    cardsEndorsement,
  } = useCardSteps(_kycStatus as KycStatus | undefined, cardStatusResponse);

  // Derived: under review state — the screen shows "your card is on its way"
  // instead of a steps list the user cannot move. Previously read from the
  // bridge.xyz endorsement alone, which is a concept neither live issuer has, so
  // a Wirex/Sumsub or Rain/Didit applicant mid-decision fell through to the
  // steps list and was asked to verify all over again.
  const isUnderReview = isCardIssuanceUnderReview({
    cardStatus: cardStatusResponse,
    cardsEndorsement,
  });

  // Track page view on mount
  useEffect(() => {
    track(TRACKING_EVENTS.CARD_ACTIVATE_PAGE_VIEWED, {
      card_status: cardStatus,
      kyc_status: _kycStatus,
      is_card_pending: isCardPending,
      is_card_blocked: isCardBlocked,
      is_under_review: isUnderReview,
      country_confirmed: countryConfirmed === 'true',
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Redirect if user already has a Rain card (active/frozen/inactive). The BD
  // minimum-deposit gate now runs before card issuance (into savings), so anyone
  // who already holds a card has cleared it — send them straight to card details
  // instead of keeping them on the issuance flow.
  useEffect(() => {
    if (!userHasCard) return;
    if (
      cardStatus === CardStatus.ACTIVE ||
      cardStatus === CardStatus.FROZEN ||
      cardStatus === CardStatus.INACTIVE
    ) {
      router.replace(path.CARD_INFO);
    }
  }, [userHasCard, cardStatus, router]);

  // Navigation handler for back button
  const handleGoBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      // Nothing to go back to (deep link into the flow) — the wallet page is
      // where the card lives now.
      router.replace(path.HOME);
    }
  };

  return {
    // Loading state
    isCardStatusLoading,
    isCheckingCountry,
    // Card status flags
    isCardPending,
    isCardBlocked,
    isUnderReview,
    activationBlockedReason,
    // Step management
    steps,
    activeStepId,
    isStepButtonEnabled,
    toggleStep,
    canToggleStep,
    activatingCard,
    // Navigation
    handleGoBack,
  };
}
