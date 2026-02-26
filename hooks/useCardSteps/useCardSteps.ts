import { useCallback, useEffect, useMemo } from 'react';
import { useRouter } from 'expo-router';
import { useShallow } from 'zustand/react/shallow';

import { path } from '@/constants/path';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { useCustomer, useKycLinkFromBridge } from '@/hooks/useCustomer';
import { useFingerprint } from '@/hooks/useFingerprint';
import { track } from '@/lib/analytics';
import { EXPO_PUBLIC_CARD_ISSUER } from '@/lib/config';
import { openIntercom } from '@/lib/intercom';
import { getCustomerFromBridge, getKycLinkFromBridge } from '@/lib/api';
import { redirectToRainVerification } from '@/lib/rainVerification';
import {
  CardProvider,
  CardStatusResponse,
  KycStatus,
  RainApplicationStatus,
} from '@/lib/types';
import { withRefreshToken } from '@/lib/utils';
import { useCountryStore } from '@/store/useCountryStore';
import { useKycStore } from '@/store/useKycStore';

// Import helpers
import { shouldStopKycFlow } from './endorsementHelpers';
import { observeFingerprintBeforeKyc } from './fingerprintHelpers';
import {
  checkAndBlockForCountryAccess,
  redirectToCollectUserInfo,
  redirectToExistingCustomerKycLink,
  showAccountOffboardedToast,
  showKycUnderReviewToast,
} from './kycFlowHelpers';
import {
  computeKycStatus,
  computeUiKycStatus,
  useProcessingWindow,
} from './kycStatusHelpers';
import { buildCardSteps, useCardActivation, useStepNavigation } from './stepHelpers';

// Re-export types
export type { Step } from './types';

/**
 * Hook that manages the card activation flow steps
 * Now uses cards endorsement status as the source of truth for step display
 */
export function useCardSteps(
  initialKycStatus?: KycStatus,
  cardStatusResponse?: CardStatusResponse | null,
) {
  const router = useRouter();
  const { kycLinkId, processingUntil, setProcessingUntil, clearProcessingUntil } =
    useKycStore(
      useShallow(state => ({
        kycLinkId: state.kycLinkId,
        processingUntil: state.processingUntil,
        setProcessingUntil: state.setProcessingUntil,
        clearProcessingUntil: state.clearProcessingUntil,
      })),
    );
  const cardIssuer =
    cardStatusResponse?.provider ?? EXPO_PUBLIC_CARD_ISSUER ?? null;
  const countryStore = useCountryStore(
    useShallow(state => ({
      countryInfo: state.countryInfo,
      getCachedIp: state.getCachedIp,
      setCachedIp: state.setCachedIp,
      getIpDetectedCountry: state.getIpDetectedCountry,
      setIpDetectedCountry: state.setIpDetectedCountry,
      countryDetectionFailed: state.countryDetectionFailed,
    })),
  );

  // Get fingerprint SDK for duplicate device detection
  const { getVisitorData } = useFingerprint();

  // Get customer data with cards endorsement
  const { data: customer } = useCustomer();
  const cardsEndorsement = useMemo(
    () => customer?.endorsements?.find(e => e.name === 'cards'),
    [customer?.endorsements],
  );

  // Get KYC link status (still needed for redirect flow)
  const { data: kycLink } = useKycLinkFromBridge(kycLinkId || undefined);

  // Compute KYC status (for processing window logic)
  const kycStatus = useMemo(
    () => computeKycStatus(kycLink?.kyc_status, initialKycStatus),
    [kycLink?.kyc_status, initialKycStatus],
  );

  // Manage processing window
  useProcessingWindow(
    initialKycStatus,
    kycStatus,
    processingUntil,
    setProcessingUntil,
    clearProcessingUntil,
    kycLink,
  );

  // Compute UI KYC status with processing window override (for tracking)
  const uiKycStatus = useMemo(
    () => computeUiKycStatus(processingUntil, kycLink?.kyc_status as KycStatus, kycStatus),
    [processingUntil, kycLink?.kyc_status, kycStatus],
  );

  // Card activation state and handlers
  const {
    cardActivated,
    activatingCard,
    handleActivateCard,
    syncCardActivationState,
    pushCardDetails,
  } = useCardActivation(router);

  // Sync card activation state with server
  useEffect(() => {
    syncCardActivationState(cardStatusResponse?.status);
  }, [cardStatusResponse?.status, syncCardActivationState]);

  // Handle the KYC flow initiation
  const handleProceedToKyc = useCallback(async () => {
    track(TRACKING_EVENTS.CARD_KYC_FLOW_TRIGGERED, {
      action: 'start',
      kycStatus: uiKycStatus,
      kycLinkId,
      hasProcessingWindow: Boolean(processingUntil),
      endorsementStatus: cardsEndorsement?.status,
      cardIssuer,
    });

    // Default to Rain KYC; only Bridge goes through Bridge flow
    if (cardIssuer !== CardProvider.BRIDGE) {
      router.push(path.KYC as any);
      return;
    }

    // Check country access (Bridge flow)
    const isBlocked = await checkAndBlockForCountryAccess(countryStore, kycLinkId);
    if (isBlocked) return;

    // Fingerprint observation + duplicate device check (fail fast before KYC)
    const fingerprintResult = await observeFingerprintBeforeKyc(getVisitorData);
    if (!fingerprintResult.canProceed) {
      track(TRACKING_EVENTS.CARD_KYC_FLOW_TRIGGERED, {
        action: 'blocked',
        reason: fingerprintResult.reason,
        kycLinkId,
      });
      return;
    }

    // Check latest KYC status (Bridge)
    try {
      if (kycLinkId) {
        const latest = await withRefreshToken(() => getKycLinkFromBridge(kycLinkId));
        const latestStatus = (latest?.kyc_status as KycStatus) || KycStatus.NOT_STARTED;

        if (latestStatus === KycStatus.UNDER_REVIEW) {
          showKycUnderReviewToast(kycLinkId);
          return;
        }

        if (latestStatus === KycStatus.OFFBOARDED) {
          showAccountOffboardedToast(kycLinkId);
          return;
        }

        // KYC link approved, but we need to check cards endorsement status
        // (KYC approval ≠ cards endorsement approval - they can differ)
        if (latestStatus === KycStatus.APPROVED) {
          const latestCustomer = await withRefreshToken(() => getCustomerFromBridge());
          const latestCardsEndorsement = latestCustomer?.endorsements?.find(
            e => e.name === 'cards',
          );

          // Check cards endorsement status:
          // - APPROVED: stop - user can order card
          // - PENDING REVIEW: stop - user should wait
          // - REVOKED/INCOMPLETE/None: continue - user needs to retry KYC for cards
          const stopFlow = shouldStopKycFlow(
            latestCardsEndorsement,
            kycLinkId,
            latestCustomer?.rejection_reasons,
          );

          if (stopFlow) return;

          // Edge case: KYC approved but cards endorsement not approved
          // Redirect user to complete KYC specifically for cards endorsement
          track(TRACKING_EVENTS.CARD_KYC_FLOW_TRIGGERED, {
            action: 'approved_missing_endorsement',
            kycLinkId,
            hasCardsEndorsement: Boolean(latestCardsEndorsement),
            cardsEndorsementStatus: latestCardsEndorsement?.status,
          });

          if (await redirectToExistingCustomerKycLink(router, kycLinkId)) return;
        }
      }
    } catch {
      track(TRACKING_EVENTS.CARD_KYC_FLOW_TRIGGERED, { action: 'status_check_failed', kycLinkId });
    }

    // Try to get a fresh KYC URL with redirect_uri, or fall back to user info collection
    if (await redirectToExistingCustomerKycLink(router, kycLinkId)) return;
    redirectToCollectUserInfo(router, countryStore.countryInfo?.countryCode);
  }, [
    router,
    kycLinkId,
    uiKycStatus,
    processingUntil,
    countryStore,
    cardsEndorsement?.status,
    getVisitorData,
  ]);

  // Rain: KYC step button handler (redirect, contact support, or proceed to KYC)
  const handleRainKYCPress = useCallback(() => {
    const status = cardStatusResponse?.rainApplicationStatus;
    const link = cardStatusResponse?.applicationExternalVerificationLink;

    if (
      status === RainApplicationStatus.DENIED ||
      status === RainApplicationStatus.LOCKED ||
      status === RainApplicationStatus.CANCELED
    ) {
      openIntercom();
      return;
    }
    if (
      (status === RainApplicationStatus.NEEDS_VERIFICATION ||
        status === RainApplicationStatus.NEEDS_INFORMATION) &&
      link?.url &&
      Object.keys(link.params ?? {}).length > 0
    ) {
      redirectToRainVerification(link);
      return;
    }
    if (status === RainApplicationStatus.NOT_STARTED || !status) {
      handleProceedToKyc();
    }
  }, [
    cardStatusResponse?.rainApplicationStatus,
    cardStatusResponse?.applicationExternalVerificationLink,
    handleProceedToKyc,
  ]);

  // Build steps based on endorsement status (Bridge) or Rain KYC status
  const steps = useMemo(
    () =>
      buildCardSteps(
        cardsEndorsement,
        customer?.rejection_reasons,
        cardActivated,
        cardStatusResponse?.activationBlocked,
        cardStatusResponse?.activationBlockedReason,
        handleProceedToKyc,
        handleActivateCard,
        pushCardDetails,
        {
          cardIssuer,
          rainApplicationStatus: cardStatusResponse?.rainApplicationStatus,
          handleRainKYCPress: cardIssuer === CardProvider.RAIN ? handleRainKYCPress : undefined,
        },
      ),
    [
      cardsEndorsement,
      customer?.rejection_reasons,
      cardActivated,
      cardStatusResponse?.activationBlocked,
      cardStatusResponse?.activationBlockedReason,
      cardStatusResponse?.rainApplicationStatus,
      handleProceedToKyc,
      handleActivateCard,
      pushCardDetails,
      cardIssuer,
      handleRainKYCPress,
    ],
  );

  // Step navigation
  const { activeStepId, isStepButtonEnabled, canToggleStep, toggleStep } = useStepNavigation(steps);

  return {
    steps,
    activeStepId,
    isStepButtonEnabled,
    toggleStep,
    canToggleStep,
    activatingCard,
    cardsEndorsement,
  };
}
