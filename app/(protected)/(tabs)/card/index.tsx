import Loading from '@/components/Loading';
import { useCardStatus } from '@/hooks/useCardStatus';
import { Redirect } from 'expo-router';
import React from 'react';

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
