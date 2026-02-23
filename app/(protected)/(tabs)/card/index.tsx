import React from 'react';
import { Redirect } from 'expo-router';

import PageLayout from '@/components/PageLayout';
import { useCardStatus } from '@/hooks/useCardStatus';

export default function Card() {
  const { data: cardStatus, isLoading } = useCardStatus();

  if (isLoading) {
    return <PageLayout isLoading />;
  }

  if (cardStatus) {
    return <Redirect href="/card/details" />;
  }

  return <Redirect href="/card-onboard" />;
}
