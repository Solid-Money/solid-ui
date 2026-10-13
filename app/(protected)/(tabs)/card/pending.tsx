import { useCallback, useEffect } from 'react';
import Toast from 'react-native-toast-message';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { CardStatusPage } from '@/components/Card/CardStatusPage';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { DEPOSIT_MODAL } from '@/constants/modals';
import { path } from '@/constants/path';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { CARD_STATUS_QUERY_KEY, useCardStatus } from '@/hooks/useCardStatus';
import { getKYCButtonText, getKYCDescription } from '@/hooks/useCardSteps/kycDisplayHelpers';
import { track } from '@/lib/analytics';
import { resumeRainKycForward } from '@/lib/api';
import { getAsset } from '@/lib/assets';
import { redirectToRainVerification } from '@/lib/rainVerification';
import { RainApplicationStatus } from '@/lib/types';
import { withRefreshToken } from '@/lib/utils';
import { resolveCardPendingDestination } from '@/lib/utils/cardPendingRouting';
import { resolveVirtualAccountPendingState } from '@/lib/utils/virtualAccountPendingState';
import { useDepositStore } from '@/store/useDepositStore';
import { useKycStore } from '@/store/useKycStore';
import { openSupportDrawer } from '@/store/useSupportDrawerStore';

const POLL_INTERVAL_MS = 5000;

export default function CardPending() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: cardStatusResponse } = useCardStatus({ refetchInterval: POLL_INTERVAL_MS });
  const kycFlow = useKycStore(state => state.kycFlow);
  const setKycFlow = useKycStore(state => state.setKycFlow);
  const setDepositModal = useDepositStore(state => state.setModal);

  // Fall back to the Rain row's own application state. The flat fields are
  // reported from the primary card-customer row, which for a Wirex cardholder
  // is their Wirex card and carries no Rain fields — so a Wirex cardholder
  // opening a Rain virtual account arrived here with Rain waiting on a
  // verification step and nothing on screen to start it.
  const rainApplicationStatus =
    cardStatusResponse?.rainApplicationStatus ?? cardStatusResponse?.rainApplication?.status;
  const verificationLink =
    cardStatusResponse?.applicationExternalVerificationLink ??
    cardStatusResponse?.rainApplication?.externalVerificationLink;
  const isVirtualAccountFlow = kycFlow === 'va';
  // Only meaningful for the virtual account: the card flow is moved off this
  // page by `resolveCardPendingDestination` once its decision lands.
  const virtualAccountState = isVirtualAccountFlow
    ? resolveVirtualAccountPendingState(cardStatusResponse)
    : 'waiting';

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

  // Rain approved a virtual-account applicant. The account itself is opened by
  // accepting the terms, so take them to that step in the Deposit flow rather
  // than telling them to wait for an email that is not coming.
  const handleOpenVirtualAccount = useCallback(() => {
    track(TRACKING_EVENTS.CARD_KYC_FLOW_TRIGGERED, {
      action: 'open_virtual_account',
      source: 'pending',
    });
    setDepositModal(DEPOSIT_MODAL.OPEN_VIRTUAL_ACCOUNT_TOS);
    router.replace(path.DEPOSIT);
  }, [router, setDepositModal]);

  // Didit declined the virtual-account identity check before anything reached
  // Rain, so a fresh verification is allowed.
  const handleRetryVerification = useCallback(() => {
    track(TRACKING_EVENTS.CARD_KYC_FLOW_TRIGGERED, {
      action: 'retry_virtual_account_kyc',
      source: 'pending',
    });
    setKycFlow('va');
    router.replace(path.KYC);
  }, [router, setKycFlow]);

  const handleAddFunds = useCallback(() => {
    setDepositModal(DEPOSIT_MODAL.OPEN_OPTIONS);
    router.push(path.DEPOSIT);
  }, [router, setDepositModal]);

  // Didit approved but the hand-off to Rain is held on the savings deposit. The
  // server re-reads the balance as it submits, so this cannot push an unfunded
  // application through; it can only come back `deposit_required`.
  const { mutate: submitHeldApplication, isPending: isSubmittingHeldApplication } = useMutation({
    mutationFn: () => withRefreshToken(() => resumeRainKycForward()),
    onSuccess: result => {
      track(TRACKING_EVENTS.CARD_KYC_FLOW_TRIGGERED, {
        action: 'deposit_hold_resume',
        resumeStatus: result?.status,
        balanceUsd: result?.balanceUsd,
        source: 'pending',
      });
      if (result?.status === 'deposit_required') {
        Toast.show({
          type: 'error',
          text1: 'Deposit not received yet',
          text2: result.reason ?? `Keep at least $${result.minimumUsd} in savings, then try again.`,
          props: { badgeText: '' },
        });
      } else if (result?.status === 'failed' || result?.status === 'not_ready') {
        Toast.show({
          type: 'error',
          text1: 'Could not submit your application',
          text2: result.reason ?? 'Please try again shortly or contact support.',
          props: { badgeText: '' },
        });
      }
      void queryClient.invalidateQueries({ queryKey: [CARD_STATUS_QUERY_KEY] });
    },
    onError: () => {
      Toast.show({
        type: 'error',
        text1: 'Could not submit your application',
        text2: 'Please try again shortly or contact support.',
        props: { badgeText: '' },
      });
    },
  });

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

  if (virtualAccountState === 'approved') {
    return (
      <CardStatusPage
        title="You're approved"
        description={'Accept the terms to open your US bank account\nfor ACH and wire deposits.'}
        header="Identity Verification"
        image={heroImage}
      >
        <Button
          variant="brand"
          onPress={handleOpenVirtualAccount}
          className="mt-6 h-12 w-full rounded-xl"
        >
          <Text className="text-base font-bold text-primary-foreground">Open my account</Text>
        </Button>
      </CardStatusPage>
    );
  }

  if (virtualAccountState === 'denied') {
    return (
      <CardStatusPage
        title="We couldn't open your account"
        description={
          "Our banking partner wasn't able to approve your\napplication. Contact support and we'll help\nwith next steps."
        }
        header="Identity Verification"
        image={heroImage}
      >
        <Button
          variant="brand"
          // Wrapped: the press event must not reach `openSupportDrawer` as its
          // prefilled chat message.
          onPress={() => openSupportDrawer()}
          className="mt-6 h-12 w-full rounded-xl"
        >
          <Text className="text-base font-bold text-primary-foreground">Contact support</Text>
        </Button>
      </CardStatusPage>
    );
  }

  if (virtualAccountState === 'verification-declined') {
    return (
      <CardStatusPage
        title="Verification declined"
        description={
          "We couldn't verify your identity. Use a valid ID\nthat is fully visible and well lit, then try again."
        }
        header="Identity Verification"
        image={heroImage}
      >
        <Button
          variant="brand"
          onPress={handleRetryVerification}
          className="mt-6 h-12 w-full rounded-xl"
        >
          <Text className="text-base font-bold text-primary-foreground">Try again</Text>
        </Button>
      </CardStatusPage>
    );
  }

  if (virtualAccountState === 'deposit-required') {
    return (
      <CardStatusPage
        title="One more step"
        description={`Your identity is verified. Keep at least $${cardStatusResponse?.minimumDepositUsd ?? 10} in\nsavings so we can submit your application.`}
        header="Identity Verification"
        image={heroImage}
      >
        <Button
          variant="brand"
          onPress={() => submitHeldApplication()}
          disabled={isSubmittingHeldApplication}
          className="mt-6 h-12 w-full rounded-xl"
        >
          <Text className="text-base font-bold text-primary-foreground">
            {isSubmittingHeldApplication ? 'Submitting…' : 'Submit application'}
          </Text>
        </Button>
        <Button
          variant="secondary"
          onPress={handleAddFunds}
          className="mt-3 h-12 w-full rounded-xl"
        >
          <Text className="text-base font-bold">Add funds</Text>
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
