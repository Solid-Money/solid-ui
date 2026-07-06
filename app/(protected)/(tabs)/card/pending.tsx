import { useEffect } from 'react';
import { useRouter } from 'expo-router';

import { CardStatusPage } from '@/components/Card/CardStatusPage';
import { path } from '@/constants/path';
import { useCardStatus } from '@/hooks/useCardStatus';
import { CardStatus, KycStatus, RainApplicationStatus } from '@/lib/types';
import { hasCard } from '@/lib/utils';

const POLL_INTERVAL_MS = 5000;

export default function CardPending() {
  const router = useRouter();
  const { data: cardStatusResponse } = useCardStatus({ refetchInterval: POLL_INTERVAL_MS });

  useEffect(() => {
    if (!cardStatusResponse) return;

    // User already has a card (e.g. status synced after this tab was open).
    if (hasCard(cardStatusResponse) && cardStatusResponse.status !== CardStatus.PENDING) {
      router.replace(path.CARD_DETAILS);
      return;
    }

    const { kycStatus, rainApplicationStatus } = cardStatusResponse;

    // Still under manual review — keep showing the pending page.
    if (kycStatus === KycStatus.UNDER_REVIEW) return;

    // Didit approved.
    if (kycStatus === KycStatus.APPROVED) {
      if (rainApplicationStatus === RainApplicationStatus.APPROVED) {
        router.replace(path.CARD_READY);
      } else {
        // Rain still needs to finish (pending, needsInformation, etc.) — let
        // the activate page render the appropriate next step / status.
        router.replace(path.CARD_ACTIVATE);
      }
      return;
    }

    // Any other terminal/incomplete state (rejected, offboarded, incomplete,
    // resubmitted, etc.) — bounce back to the activate page so the user sees
    // the error or retry CTA.
    if (kycStatus && kycStatus !== KycStatus.NOT_STARTED) {
      router.replace(`${String(path.CARD_ACTIVATE)}?kycStatus=${kycStatus}` as any);
    }
  }, [cardStatusResponse, router]);

  return (
    <CardStatusPage
      title="Your ID verification is under review!"
      description={
        'Thanks for your submission. Your\nidentity is now being verified. You will be\nnotified by mail once you get approved'
      }
    />
  );
}
