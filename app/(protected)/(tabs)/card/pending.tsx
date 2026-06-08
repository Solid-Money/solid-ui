import { useEffect } from 'react';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';

import { CardStatusPage } from '@/components/Card/CardStatusPage';
import { path } from '@/constants/path';
import { useCardStatus } from '@/hooks/useCardStatus';
import { getAsset } from '@/lib/assets';
import { CardStatus, KycStatus, RainApplicationStatus } from '@/lib/types';
import { hasCard } from '@/lib/utils';
import { useKycStore } from '@/store/useKycStore';

const POLL_INTERVAL_MS = 5000;

export default function CardPending() {
  const router = useRouter();
  const { data: cardStatusResponse } = useCardStatus({ refetchInterval: POLL_INTERVAL_MS });
  const kycFlow = useKycStore(state => state.kycFlow);

  useEffect(() => {
    if (!cardStatusResponse) return;

    // VA-initiated KYC: keep the user on the pending submission view. They
    // re-enter the VA flow via the Deposit modal when KYC + Rain are ready.
    if (kycFlow === 'va') return;

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
  }, [cardStatusResponse, kycFlow, router]);

  return (
    <CardStatusPage
      title="Thank you for your submission!"
      description={
        'Thanks for your submission. Your\nidentity is now being verified. You will be\nnotified by mail once you get approved'
      }
      header="Identity Verification"
      image={
        <Image
          source={getAsset('images/identity-review.png')}
          alt="Identity Verification"
          style={{ width: 402, height: 268 }}
          contentFit="contain"
        />
      }
    />
  );
}
