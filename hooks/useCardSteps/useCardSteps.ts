import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { track } from '@/lib/analytics';
import { getCustomerFromBridge, getKycLinkFromBridge } from '@/lib/api';
import { CardStatusResponse, KycStatus } from '@/lib/types';
import { withRefreshToken } from '@/lib/utils';
import { useCountryStore } from '@/store/useCountryStore';
import { useKycStore } from '@/store/useKycStore';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo } from 'react';
import { useCustomer, useKycLinkFromBridge } from '../useCustomer';

// Import helpers
import { processCardsEndorsement } from './endorsementHelpers';
import {
  checkAndBlockForCountryAccess,
  redirectToCollectUserInfo,
  redirectToExistingCustomerKycLink,
  redirectToExistingKycLink,
  showAccountOffboardedToast,
  showKycUnderReviewToast,
} from './kycFlowHelpers';
import { computeKycStatus, computeUiKycStatus, useProcessingWindow } from './kycStatusHelpers';
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
  const { kycLinkId, processingUntil, setProcessingUntil, clearProcessingUntil } = useKycStore();
  const countryStore = useCountryStore();

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
    });

    // Check country access
    const isBlocked = await checkAndBlockForCountryAccess(countryStore, kycLinkId);
    if (isBlocked) return;

    // Check latest KYC status
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

        if (latestStatus === KycStatus.APPROVED) {
          const latestCustomer = await withRefreshToken(() => getCustomerFromBridge());
          const latestCardsEndorsement = latestCustomer?.endorsements?.find(
            e => e.name === 'cards',
          );

          if (
            processCardsEndorsement(
              latestCardsEndorsement,
              kycLinkId,
              latestCustomer?.rejection_reasons,
            )
          ) {
            return;
          }

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

    // Try existing KYC link or fall back to user info collection
    if (kycLink?.kyc_link && redirectToExistingKycLink(router, kycLink.kyc_link, kycLinkId)) return;
    redirectToCollectUserInfo(router);
  }, [
    router,
    kycLinkId,
    kycLink?.kyc_link,
    uiKycStatus,
    processingUntil,
    countryStore,
    cardsEndorsement?.status,
  ]);

  // Build steps based on endorsement status
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
      ),
    [
      cardsEndorsement,
      customer?.rejection_reasons,
      cardActivated,
      cardStatusResponse?.activationBlocked,
      cardStatusResponse?.activationBlockedReason,
      handleProceedToKyc,
      handleActivateCard,
      pushCardDetails,
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
