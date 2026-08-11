import { useCallback, useEffect, useMemo } from 'react';
import Toast from 'react-native-toast-message';
import { useRouter } from 'expo-router';
import { useShallow } from 'zustand/react/shallow';

import { DEPOSIT_MODAL } from '@/constants/modals';
import { path } from '@/constants/path';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { useBalances } from '@/hooks/useBalances';
import { useCustomer, useKycLinkFromBridge } from '@/hooks/useCustomer';
import { track } from '@/lib/analytics';
import { getCustomerFromBridge, getKycLinkFromBridge, getProviderRouting } from '@/lib/api';
import { EXPO_PUBLIC_CARD_ISSUER } from '@/lib/config';
import { redirectToRainVerification } from '@/lib/rainVerification';
import { CardProvider, CardStatusResponse, KycProvider, KycStatus } from '@/lib/types';
import { hasMetSavingsDeposit, withRefreshToken } from '@/lib/utils';
import { useCountryStore } from '@/store/useCountryStore';
import { useDepositStore } from '@/store/useDepositStore';
import { useKycStore } from '@/store/useKycStore';
import { openSupportDrawer } from '@/store/useSupportDrawerStore';

// Import helpers
import { shouldStopKycFlow } from './endorsementHelpers';
import {
  checkAndBlockForCountryAccess,
  redirectToCollectUserInfo,
  redirectToExistingCustomerKycLink,
  showAccountOffboardedToast,
  showKycUnderReviewToast,
} from './kycFlowHelpers';
import { computeKycStatus, computeUiKycStatus, useProcessingWindow } from './kycStatusHelpers';
import { resolveRainKycAction } from './rainKycAction';
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
  const {
    kycLinkId,
    processingUntil,
    setProcessingUntil,
    clearProcessingUntil,
    setKycFlow,
    setKycProvider,
  } = useKycStore(
    useShallow(state => ({
      kycLinkId: state.kycLinkId,
      processingUntil: state.processingUntil,
      setProcessingUntil: state.setProcessingUntil,
      clearProcessingUntil: state.clearProcessingUntil,
      setKycFlow: state.setKycFlow,
      setKycProvider: state.setKycProvider,
    })),
  );
  // Consider Rain when the API returns rainApplicationStatus (provider may be
  // omitted). An external verification link is Rain-only too, so treat it as
  // the same evidence: if the response carries a resubmission link, the Rain
  // step handler must be wired even when the status field is missing —
  // otherwise the step falls back to restarting Didit and the link is
  // unreachable.
  const cardIssuer =
    cardStatusResponse?.rainApplicationStatus != null ||
    cardStatusResponse?.applicationExternalVerificationLink != null
      ? CardProvider.RAIN
      : (cardStatusResponse?.provider ?? EXPO_PUBLIC_CARD_ISSUER ?? null);
  const countryStore = useCountryStore(useShallow(state => ({ countryInfo: state.countryInfo })));

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
  const { cardActivated, activatingCard, syncCardActivationState, pushCardDetails, pushCardReady } =
    useCardActivation(router);

  // Opens the deposit-to-savings (soUSD) flow used by the BD "deposit first"
  // step. The global DepositModalProvider is mounted app-wide, so this works
  // from the card activation screen without mounting a modal locally.
  const openSavingsDepositModal = useCallback(
    () => useDepositStore.getState().setModal(DEPOSIT_MODAL.OPEN_OPTIONS),
    [],
  );

  // The BD minimum-deposit step now completes from the savings (soUSD) balance,
  // not card collateral — the card doesn't exist yet when the deposit happens.
  const { totalSoUSD } = useBalances();
  const savingsDepositMet = hasMetSavingsDeposit(totalSoUSD);

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

    // Non-Bridge users go through Didit (Rain) by default. The backend is
    // authoritative for whether this jurisdiction should instead use Sumsub
    // (Wirex). Defaulting to Didit — and staying there if the call fails — keeps
    // the widely-available flow as the safe fallback.
    if (cardIssuer !== CardProvider.BRIDGE) {
      setKycFlow('card');
      const countryCode = countryStore.countryInfo?.countryCode;
      let kycProvider = KycProvider.DIDIT;
      if (countryCode) {
        try {
          const routing = await withRefreshToken(() => getProviderRouting(countryCode));
          if (routing?.kycProvider) kycProvider = routing.kycProvider;
        } catch {
          // backend unavailable → stay on Didit (available to everyone)
        }
      }
      setKycProvider(kycProvider);
      track(TRACKING_EVENTS.CARD_KYC_FLOW_TRIGGERED, {
        action: 'route',
        kycProvider,
        countryCode,
      });
      router.push((kycProvider === KycProvider.SUMSUB ? path.SUMSUB_KYC : path.KYC) as any);
      return;
    }

    setKycFlow('card');

    // Check country access (Bridge flow)
    const isBlocked = await checkAndBlockForCountryAccess(countryStore, kycLinkId);
    if (isBlocked) return;

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
    cardIssuer,
    setKycFlow,
    setKycProvider,
  ]);

  // Rain: KYC step button handler (redirect, contact support, or proceed to KYC)
  const handleRainKYCPress = useCallback(() => {
    const status = cardStatusResponse?.rainApplicationStatus;
    const link = cardStatusResponse?.applicationExternalVerificationLink;
    // Rain signs the link's params, so a link without them is not openable.
    const usableLink = link?.url && Object.keys(link.params ?? {}).length > 0 ? link : null;

    const reportUnavailableLink = () => {
      Toast.show({
        type: 'error',
        text1: 'Verification link unavailable',
        text2: 'Unable to open verification. Please try again later or contact support.',
        props: { badgeText: '' },
      });
      track(TRACKING_EVENTS.CARD_KYC_FLOW_TRIGGERED, {
        action: 'verification_link_missing',
        rainApplicationStatus: status,
        kycApplicationEstablished: cardStatusResponse?.kycApplicationEstablished,
        hasLink: Boolean(link),
        hasUrl: Boolean(link?.url),
        hasParams: Boolean(link?.params && Object.keys(link.params).length > 0),
      });
    };

    const action = resolveRainKycAction({
      rainApplicationStatus: status,
      hasUsableLink: Boolean(usableLink),
      kycApplicationEstablished: cardStatusResponse?.kycApplicationEstablished,
    });

    switch (action.type) {
      case 'support':
        openSupportDrawer();
        return;
      case 'external-link':
        // resolveRainKycAction only returns this when hasUsableLink was true.
        if (usableLink) redirectToRainVerification(usableLink);
        return;
      case 'start-kyc':
        handleProceedToKyc();
        return;
      case 'link-unavailable':
        reportUnavailableLink();
        return;
      case 'none':
        return;
    }
  }, [
    cardStatusResponse?.rainApplicationStatus,
    cardStatusResponse?.applicationExternalVerificationLink,
    cardStatusResponse?.kycApplicationEstablished,
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
        pushCardReady,
        pushCardDetails,
        {
          cardIssuer,
          rainApplicationStatus: cardStatusResponse?.rainApplicationStatus,
          kycStatus: cardStatusResponse?.kycStatus,
          kycWarnings: cardStatusResponse?.kycWarnings,
          handleRainKYCPress: cardIssuer === CardProvider.RAIN ? handleRainKYCPress : undefined,
          // Prefer the KYC residence country from the backend, but fall back to
          // the client-detected/selected country so the deposit step shows for a
          // BD user before they have a card customer (getCardStatus 404s then).
          country: cardStatusResponse?.country ?? countryStore.countryInfo?.countryCode,
          cardCollateralDeposited: cardStatusResponse?.cardCollateralDeposited,
          savingsDepositMet,
          openSavingsDepositModal,
        },
      ),
    [
      cardsEndorsement,
      customer?.rejection_reasons,
      cardActivated,
      cardStatusResponse?.activationBlocked,
      cardStatusResponse?.activationBlockedReason,
      cardStatusResponse?.rainApplicationStatus,
      cardStatusResponse?.kycStatus,
      cardStatusResponse?.kycWarnings,
      cardStatusResponse?.country,
      cardStatusResponse?.cardCollateralDeposited,
      countryStore.countryInfo?.countryCode,
      savingsDepositMet,
      handleProceedToKyc,
      pushCardReady,
      pushCardDetails,
      cardIssuer,
      handleRainKYCPress,
      openSavingsDepositModal,
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
