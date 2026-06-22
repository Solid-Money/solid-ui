import { useCallback, useEffect } from 'react';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';

import { CardStatusPage } from '@/components/Card/CardStatusPage';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { path } from '@/constants/path';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { useCardStatus } from '@/hooks/useCardStatus';
import { getKYCButtonText, getKYCDescription } from '@/hooks/useCardSteps/kycDisplayHelpers';
import { track } from '@/lib/analytics';
import { getAsset } from '@/lib/assets';
import { redirectToRainVerification } from '@/lib/rainVerification';
import { CardStatus, KycStatus, RainApplicationStatus } from '@/lib/types';
import { getActiveCardRoute, hasCard } from '@/lib/utils';
import { useKycStore } from '@/store/useKycStore';

const POLL_INTERVAL_MS = 5000;

export default function CardPending() {
  const router = useRouter();
  const { data: cardStatusResponse } = useCardStatus({ refetchInterval: POLL_INTERVAL_MS });
  const kycFlow = useKycStore(state => state.kycFlow);

  const rainApplicationStatus = cardStatusResponse?.rainApplicationStatus;
  const verificationLink = cardStatusResponse?.applicationExternalVerificationLink;

  // Rain "needsVerification" / "needsInformation" are synchronous and
  // user-actionable: instead of parking the user on the passive "we're
  // verifying you" page, surface the same CTA the card activate flow shows
  // (mirrors handleRainKYCPress) that redirects to Rain's external step. Only
  // when a usable link is present — otherwise fall through to the default page.
  const hasVerificationLink = Boolean(
    verificationLink?.url && Object.keys(verificationLink.params ?? {}).length > 0,
  );
  const showRainVerificationCta =
    hasVerificationLink &&
    (rainApplicationStatus === RainApplicationStatus.NEEDS_VERIFICATION ||
      rainApplicationStatus === RainApplicationStatus.NEEDS_INFORMATION);

  const handleRainVerification = useCallback(() => {
    if (!verificationLink?.url) return;
    track(TRACKING_EVENTS.CARD_KYC_FLOW_TRIGGERED, {
      action: 'continue_verification',
      rainApplicationStatus,
      source: 'pending',
    });
    // VA users re-enter via the Deposit flow; card users via the activate page.
    const redirectBack = kycFlow === 'va' ? String(path.DEPOSIT) : String(path.CARD_ACTIVATE);
    redirectToRainVerification(verificationLink, redirectBack);
  }, [verificationLink, rainApplicationStatus, kycFlow]);

  useEffect(() => {
    if (!cardStatusResponse) return;

    // Rain needs an external verification / information step with a usable
    // link — keep the user here and let the page render the CTA instead of
    // redirecting (applies to both the card and VA flows).
    if (showRainVerificationCta) return;

    // VA-initiated KYC: keep the user on the pending submission view. They
    // re-enter the VA flow via the Deposit modal when KYC + Rain are ready.
    if (kycFlow === 'va') return;

    // User already has a card (e.g. status synced after this tab was open).
    if (hasCard(cardStatusResponse) && cardStatusResponse.status !== CardStatus.PENDING) {
      // BD users still owe a minimum deposit — route them through the issuance
      // flow (activate) rather than straight to card details.
      router.replace(getActiveCardRoute(cardStatusResponse));
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
  }, [cardStatusResponse, kycFlow, router, showRainVerificationCta]);

  // Rain needs an external verification / information step — surface an
  // actionable CTA rather than the passive "we'll notify you by mail" copy,
  // since the user can complete it right now (mirrors the card activate page).
  if (showRainVerificationCta) {
    const isNeedsInformation = rainApplicationStatus === RainApplicationStatus.NEEDS_INFORMATION;
    return (
      <CardStatusPage
        title={isNeedsInformation ? 'Additional information needed' : 'Verify your identity'}
        description={getKYCDescription(rainApplicationStatus, cardStatusResponse?.kycWarnings)}
        header="Identity Verification"
        image={
          <Image
            source={getAsset('images/identity-review.png')}
            alt="Identity Verification"
            style={{ width: 402, height: 268 }}
            contentFit="contain"
          />
        }
      >
        <Button
          variant="brand"
          onPress={handleRainVerification}
          className="mt-6 h-12 w-full rounded-xl"
        >
          <Text className="text-base font-bold text-primary-foreground">
            {getKYCButtonText(rainApplicationStatus) ?? 'Continue verification'}
          </Text>
        </Button>
      </CardStatusPage>
    );
  }

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
