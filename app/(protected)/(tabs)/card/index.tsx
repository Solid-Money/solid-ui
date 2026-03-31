import React from 'react';
import { Redirect } from 'expo-router';

import CardWaitlistPage from '@/components/CardWaitlist/CardWaitlistPage';
import PageLayout from '@/components/PageLayout';
import { useCardStatus } from '@/hooks/useCardStatus';
import { RainApplicationStatus } from '@/lib/types';
import { hasCard, hasCardStatusWithRainApplication } from '@/lib/utils';

export default function Card() {
  const { data: cardStatus, isLoading } = useCardStatus();
  const userHasCard = hasCard(cardStatus);
  const hasCardStatus = hasCardStatusWithRainApplication(cardStatus);

  if (isLoading) {
    return <PageLayout isLoading>{null}</PageLayout>;
  }

  if (userHasCard) {
    return <Redirect href="/card/details" />;
  }

  if (hasCardStatus) {
    const rainStatus = cardStatus?.rainApplicationStatus;

    if (rainStatus === RainApplicationStatus.APPROVED) {
      return <Redirect href="/card/ready" />;
    }

    if (
      rainStatus === RainApplicationStatus.PENDING ||
      rainStatus === RainApplicationStatus.MANUAL_REVIEW
    ) {
      return <Redirect href="/card/pending" />;
    }

    return <Redirect href="/card/activate" />;
  }

  return <CardWaitlistPage />;
}
