import React from 'react';
import { Redirect } from 'expo-router';

import Loading from '@/components/Loading';
import { useCardStatus } from '@/hooks/useCardStatus';

export default function Card() {
  const { data: cardStatus, isLoading } = useCardStatus();

  if (isLoading) {
    return <Loading />;
  }

  if (cardStatus) {
    return <Redirect href="/card/details" />;
  }

  return <Redirect href="/card-onboard" />;
}
