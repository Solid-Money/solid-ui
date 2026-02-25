import { useEffect } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { EndorsementStatus } from '@/components/BankTransfer/enums';
import { path } from '@/constants/path';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { useCardStatus } from '@/hooks/useCardStatus';
import { useCardSteps } from '@/hooks/useCardSteps';
import { useCountryCheck } from '@/hooks/useCountryCheck';
import { track } from '@/lib/analytics';
import { hasCard } from '@/lib/utils';
import { CardStatus, KycStatus } from '@/lib/types';

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
  const { data: cardStatusResponse } = useCardStatus();
  const cardStatus = cardStatusResponse?.status;
  const isCardPending = cardStatus === CardStatus.PENDING;
  const isCardBlocked = Boolean(cardStatusResponse?.activationBlocked);
  const activationBlockedReason =
    cardStatusResponse?.activationBlockedReason ||
    'There was an issue activating your card. Please contact support.';

  // Country check logic (Rain-first: Bridge-only = no card)
  const userHasCard = hasCard(cardStatusResponse);
  const skipCountryCheck = countryConfirmed === 'true' || userHasCard;
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

  // Derived: under review state
  const isUnderReview =
    cardsEndorsement?.status === EndorsementStatus.INCOMPLETE &&
    Array.isArray(cardsEndorsement?.requirements?.pending) &&
    cardsEndorsement.requirements.pending.length > 0;

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

  // Redirect if user already has a Rain card (active/frozen/inactive)
  useEffect(() => {
    if (!userHasCard) return;
    if (
      cardStatus === CardStatus.ACTIVE ||
      cardStatus === CardStatus.FROZEN ||
      cardStatus === CardStatus.INACTIVE
    ) {
      router.replace(path.CARD_DETAILS);
    }
  }, [userHasCard, cardStatus, router]);

  // Navigation handler for back button
  const handleGoBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.push(path.CARD);
    }
  };

  return {
    // Loading state
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
