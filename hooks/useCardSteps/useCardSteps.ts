import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { track } from '@/lib/analytics';
import { getCustomerFromBridge, getKycLinkFromBridge } from '@/lib/api';
import { CardStatusResponse, KycStatus } from '@/lib/types';
import { withRefreshToken } from '@/lib/utils';
import { useCountryStore } from '@/store/useCountryStore';
import { useKycStore } from '@/store/useKycStore';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo } from 'react';
import { useKycLinkFromBridge } from '../useCustomer';

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
import {
  computeKycStatus,
  computeUiKycStatus,
  formatRejectionReasons,
  useProcessingWindow,
} from './kycStatusHelpers';
import { buildCardSteps, useCardActivation, useStepNavigation } from './stepHelpers';

// Re-export types
export type { Step } from './types';

/**
 * Hook that manages the card activation flow steps
 */
export function useCardSteps(
  initialKycStatus?: KycStatus,
  cardStatusResponse?: CardStatusResponse | null,
) {
  const router = useRouter();
  const { kycLinkId, processingUntil, setProcessingUntil, clearProcessingUntil } = useKycStore();
  const countryStore = useCountryStore();

  // Get KYC link status
  const { data: kycLink } = useKycLinkFromBridge(kycLinkId || undefined);

  // Compute KYC status
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

  // Compute UI KYC status with processing window override
  const uiKycStatus = useMemo(
    () => computeUiKycStatus(processingUntil, kycLink?.kyc_status as KycStatus, kycStatus),
    [processingUntil, kycLink?.kyc_status, kycStatus],
  );

  // Format rejection reasons
  const rejectionReasonsText = useMemo(
    () => (kycStatus === KycStatus.REJECTED ? formatRejectionReasons(kycLink) : undefined),
    [kycStatus, kycLink],
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
          const customer = await withRefreshToken(() => getCustomerFromBridge());
          const cardsEndorsement = customer?.endorsements?.find(e => e.name === 'cards');

          if (processCardsEndorsement(cardsEndorsement, kycLinkId, customer?.rejection_reasons)) {
            return;
          }

          track(TRACKING_EVENTS.CARD_KYC_FLOW_TRIGGERED, {
            action: 'approved_missing_endorsement',
            kycLinkId,
            hasCardsEndorsement: Boolean(cardsEndorsement),
            cardsEndorsementStatus: cardsEndorsement?.status,
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
  }, [router, kycLinkId, kycLink?.kyc_link, uiKycStatus, processingUntil, countryStore]);

  // Build steps
  const steps = useMemo(
    () =>
      buildCardSteps(
        uiKycStatus,
        cardActivated,
        cardStatusResponse?.activationBlocked,
        cardStatusResponse?.activationBlockedReason,
        rejectionReasonsText,
        handleProceedToKyc,
        handleActivateCard,
        pushCardDetails,
      ),
    [
      uiKycStatus,
      cardActivated,
      cardStatusResponse?.activationBlocked,
      cardStatusResponse?.activationBlockedReason,
      rejectionReasonsText,
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
    uiKycStatus,
  };
}
