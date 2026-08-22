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
import { RainApplicationStatus } from '@/lib/types';
import { resolveCardPendingDestination } from '@/lib/utils/cardPendingRouting';
import { useKycStore } from '@/store/useKycStore';

const POLL_INTERVAL_MS = 5000;

export default function CardPending() {
  const router = useRouter();
  const { data: cardStatusResponse } = useCardStatus({ refetchInterval: POLL_INTERVAL_MS });
  const kycFlow = useKycStore(state => state.kycFlow);

  const rainApplicationStatus = cardStatusResponse?.rainApplicationStatus;
  const verificationLink = cardStatusResponse?.applicationExternalVerificationLink;
  const isVirtualAccountFlow = kycFlow === 'va';

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
    const redirectBack = isVirtualAccountFlow ? String(path.DEPOSIT) : String(path.CARD_ACTIVATE);
    redirectToRainVerification(verificationLink, redirectBack);
  }, [verificationLink, rainApplicationStatus, isVirtualAccountFlow]);

  // `/cards/status` is polled above, so this runs on every change: the moment the
  // KYC decision stops being pending the user is moved on by itself. They used to
  // have to press back to discover it had landed.
  useEffect(() => {
    const destination = resolveCardPendingDestination({
      cardStatus: cardStatusResponse,
      kycFlow,
      hasRainVerificationCta: showRainVerificationCta,
    });
    if (destination) router.replace(destination);
  }, [cardStatusResponse, kycFlow, router, showRainVerificationCta]);

  /**
   * The faded Solid card for card KYC; the purple Solid shield for virtual-account
   * KYC. This page serves both flows, and the shield used to show for both — so a
   * user who had just been verified *for a card* was shown the artwork that
   * belongs to the bank-account journey.
   */
  const heroImage = isVirtualAccountFlow ? (
    <Image
      source={getAsset('images/identity-review.png')}
      alt="Identity Verification"
      style={{ width: 402, height: 268 }}
      contentFit="contain"
    />
  ) : (
    <Image
      source={getAsset('images/card-fade.png')}
      alt="Solid Card"
      style={{ width: 402, height: 268 }}
      contentFit="contain"
    />
  );

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
        image={heroImage}
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
        isVirtualAccountFlow
          ? 'Thanks for your submission. Your\nidentity is now being verified. You will be\nnotified by mail once you get approved'
          : "Your identity is being verified. We'll take\nyou to the next step as soon as it's done —\nno need to check back."
      }
      header="Identity Verification"
      image={heroImage}
    />
  );
}
