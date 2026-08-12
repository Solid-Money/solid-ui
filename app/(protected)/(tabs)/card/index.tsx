import React from 'react';
import { Redirect } from 'expo-router';

import PageLayout from '@/components/PageLayout';
import { path } from '@/constants/path';
import { useCardStatus } from '@/hooks/useCardStatus';
import {
  getActiveCardRoute,
  hasCard,
  hasCardStatusWithRainApplication,
  hasPendingCard,
} from '@/lib/utils';

/**
 * `/card` is deprecated as a destination — it used to render the standalone card
 * waitlist page, which the redesign replaced (the card now lives on the wallet
 * page, and getting one starts at country selection). In-app navigation goes
 * straight to the right screen; this route stays registered purely as a
 * redirect shim so deep links, bookmarks and old push payloads still land
 * somewhere current.
 */
export default function Card() {
  const { data: cardStatus, isLoading } = useCardStatus();

  if (isLoading) {
    return <PageLayout isLoading>{null}</PageLayout>;
  }

  // BD users who haven't met the minimum card deposit are sent to the issuance
  // flow (activate) to complete the deposit step; everyone else goes straight
  // to card details.
  if (hasCard(cardStatus)) {
    return <Redirect href={getActiveCardRoute(cardStatus)} />;
  }

  // A card is ordered but the issuer hasn't opened it yet. The issuance flow
  // renders the "on its way" state and polls until it does; country selection
  // would restart onboarding this user already completed.
  if (hasPendingCard(cardStatus)) {
    return <Redirect href={path.CARD_ACTIVATE} />;
  }

  // A Rain application is already in flight (KYC submitted, card pending) —
  // resume the issuance flow rather than restarting onboarding.
  if (hasCardStatusWithRainApplication(cardStatus)) {
    return <Redirect href={path.CARD_ACTIVATE} />;
  }

  return <Redirect href={path.CARD_COUNTRY_SELECTION} />;
}
