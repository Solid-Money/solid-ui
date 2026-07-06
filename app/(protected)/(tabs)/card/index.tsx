import React from 'react';
import { Redirect } from 'expo-router';

import CardWaitlistPage from '@/components/CardWaitlist/CardWaitlistPage';
import PageLayout from '@/components/PageLayout';
import { useCardStatus } from '@/hooks/useCardStatus';
import { RainApplicationStatus } from '@/lib/types';
import { getActiveCardRoute, hasCard, hasCardStatusWithRainApplication } from '@/lib/utils';

export default function Card() {
  const { data: cardStatus, isLoading } = useCardStatus();
  const userHasCard = hasCard(cardStatus);
  const hasCardStatus = hasCardStatusWithRainApplication(cardStatus);

  if (isLoading) {
    return <PageLayout isLoading>{null}</PageLayout>;
  }

  if (userHasCard) {
    // BD users who haven't met the minimum card deposit are sent to the
    // issuance flow (activate) to complete the deposit step; everyone else
    // goes straight to card details.
    return <Redirect href={getActiveCardRoute(cardStatus)} />;
  }

  return <CardWaitlistPage />;
}
