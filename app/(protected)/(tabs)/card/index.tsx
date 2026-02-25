import React, { useEffect, useState } from 'react';
import { Redirect } from 'expo-router';

import PageLayout from '@/components/PageLayout';
import { useCardStatus } from '@/hooks/useCardStatus';
import { redirectToRainVerification } from '@/lib/rainVerification';
import { hasCard } from '@/lib/utils';

export default function Card() {
  const { data: cardStatus, isLoading } = useCardStatus();
  const [verificationRedirectChecked, setVerificationRedirectChecked] = useState(false);
  const userHasCard = hasCard(cardStatus);

  const needsVerification = cardStatus?.rainApplicationStatus === 'needsVerification';
  const verificationLink = cardStatus?.applicationExternalVerificationLink;

  useEffect(() => {
    if (
      isLoading ||
      userHasCard ||
      !needsVerification ||
      !verificationLink ||
      verificationRedirectChecked
    )
      return;
    redirectToRainVerification(verificationLink);
    setVerificationRedirectChecked(true);
  }, [isLoading, userHasCard, needsVerification, verificationLink, verificationRedirectChecked]);

  if (isLoading) {
    return <PageLayout isLoading />;
  }

  if (needsVerification && verificationLink) {
    return <PageLayout isLoading />;
  }

  if (userHasCard) {
    return <Redirect href="/card/details" />;
  }

  return <Redirect href="/card-onboard" />;
}
