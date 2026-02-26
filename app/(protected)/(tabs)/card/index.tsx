import React from 'react';
import { Redirect } from 'expo-router';

import PageLayout from '@/components/PageLayout';
import { useCardStatus } from '@/hooks/useCardStatus';
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
    return <Redirect href="/card/activate" />;
  }

  return <Redirect href="/card-onboard" />;
}
