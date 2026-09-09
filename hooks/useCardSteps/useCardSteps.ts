import { useCallback, useEffect, useMemo } from 'react';
import Toast from 'react-native-toast-message';
import { useRouter } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useShallow } from 'zustand/react/shallow';

import { path } from '@/constants/path';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { useBalances } from '@/hooks/useBalances';
import { CARD_STATUS_QUERY_KEY } from '@/hooks/useCardStatus';
import { useCustomer, useKycLinkFromBridge } from '@/hooks/useCustomer';
import { useOpenDepositFlow } from '@/hooks/useOpenDepositFlow';
import { useProspectiveCardIssuer } from '@/hooks/useProspectiveCardIssuer';
import { track } from '@/lib/analytics';
import { getCustomerFromBridge, getKycLinkFromBridge, resumeRainKycForward } from '@/lib/api';
import { EXPO_PUBLIC_CARD_ISSUER } from '@/lib/config';
import { resolveKycProvider } from '@/lib/kycProviderRouting';
import { redirectToRainVerification } from '@/lib/rainVerification';
import { CardProvider, CardStatusResponse, KycProvider, KycStatus } from '@/lib/types';
import { hasMetSavingsDeposit, requiresCardDeposit, withRefreshToken } from '@/lib/utils';
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
import { openCardSavingsDeposit } from './savingsDepositEntry';
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

  // Opens the deposit-to-savings (soUSD) flow used by the minimum-deposit
  // steps. The global DepositModalProvider is mounted app-wide, so this works
  // from the card activation screen without mounting a modal locally.
  //
  // See openCardSavingsDeposit: this is the savings direct-deposit flow (token →
  // network → per-session address, polled for the transfer), replacing the
  // legacy static-Safe-address route.
  const openDepositFlow = useOpenDepositFlow();
  const openSavingsDepositModal = useCallback(
    () => openCardSavingsDeposit(useDepositStore.getState(), openDepositFlow),
    [openDepositFlow],
  );

  // Whether to show the minimum-deposit steps at all.
  //
  // `/cards/status.depositRequired` is the answer — it comes from the same
  // server-side rule that enforces the gate. It only exists once a card customer
  // does, though, and the screen has to decide before that; so for that window
  // we ask the routing endpoint which issuer would serve this user. Deliberately
  // NOT decided from the client's country: on this side that is an IP guess, and
  // deciding a money gate on one is how the previous gate ended up optional
  // behind a VPN.
  const { issuer: prospectiveIssuer } = useProspectiveCardIssuer({
    enabled: cardStatusResponse?.depositRequired == null,
  });
  const depositRequired = requiresCardDeposit({
    depositRequired: cardStatusResponse?.depositRequired,
    issuer: cardStatusResponse?.provider ?? prospectiveIssuer,
  });

  // The minimum-deposit step completes from the savings (soUSD) balance, not
  // card collateral — the card doesn't exist yet when the deposit happens. The
  // bar comes from the backend so it can move without an app release.
  const { totalSoUSD } = useBalances();
  const savingsDepositMet = hasMetSavingsDeposit(
    totalSoUSD,
    cardStatusResponse?.minimumDepositUsd ?? undefined,
  );

  /**
   * Submits an application that was parked because the applicant stopped
   * holding their deposit — the "hold" step's action.
   *
   * The balance shown here is a client-side read and is only what decides
   * whether the button is offered. The server re-reads the position on-chain as
   * it submits, so a stale or optimistic local balance cannot get an unfunded
   * application through; it can only produce the `deposit_required` answer
   * handled below.
   */
  const queryClient = useQueryClient();
  const { mutate: runSubmitPendingApplication, isPending: isSubmittingPendingApplication } =
    useMutation({
      mutationFn: () => withRefreshToken(() => resumeRainKycForward()),
      onSuccess: result => {
        track(TRACKING_EVENTS.CARD_KYC_FLOW_TRIGGERED, {
          action: 'deposit_hold_resume',
          resumeStatus: result?.status,
          balanceUsd: result?.balanceUsd,
        });

        if (result?.status === 'deposit_required') {
          Toast.show({
            type: 'error',
            text1: 'Deposit not received yet',
            text2:
              result.reason ?? `Keep at least $${result.minimumUsd} in savings, then try again.`,
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

        // Refetch either way: a successful submit clears the step, and a refusal
        // may still have moved the balance the server reported.
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
  // Wrapped so the step's press event isn't handed to `mutate` as its variables.
  const submitPendingApplication = useCallback(
    () => runSubmitPendingApplication(),
    [runSubmitPendingApplication],
  );

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
    //
    // The country is resolved inside `resolveKycProvider`, not read from this
    // closure: entry points run the country gate and then call this action in
    // the same tick, so a country captured at render time is still the pre-gate
    // one and a Wirex user would be sent to Didit on their first press.
    if (cardIssuer !== CardProvider.BRIDGE) {
      setKycFlow('card');
      const { kycProvider, countryCode } = await resolveKycProvider();
      setKycProvider(kycProvider);
      track(TRACKING_EVENTS.CARD_KYC_FLOW_TRIGGERED, {
        action: 'route',
        kycProvider,
        countryCode,
      });

      if (kycProvider === KycProvider.SUMSUB) {
        /**
         * A verification that has already been submitted must not be restarted.
         * Sumsub GREEN hands off to Wirex, which then adjudicates, so an
         * UNDER_REVIEW user is mid-hand-off — and if that forward stalled (a
         * Wirex outage; see the admin retry endpoint) they would sit here
         * pressing a button that opens a brand new session, hit the country
         * gate on it, and be told to confirm a country to redo work they had
         * already finished. The Bridge branch below has always guarded this;
         * the Sumsub path did not.
         *
         * `kycStatus`, not `uiKycStatus`: the latter can be an optimistic
         * post-submit window, while this needs the backend's own answer — and
         * for a Wirex user there is no Bridge kycLink, so it is exactly what
         * /cards/status reported.
         */
        if (kycStatus === KycStatus.UNDER_REVIEW) {
          track(TRACKING_EVENTS.CARD_KYC_FLOW_TRIGGERED, {
            action: 'already_under_review',
            kycProvider,
          });
          router.push(path.CARD_PENDING as any);
          return;
        }

        /**
         * Sumsub card sessions REQUIRE a country the user declared themselves —
         * an IP guess is refused server-side, because `user.country` pins which
         * issuer serves them and nothing writes it back. Ask here rather than
         * letting the session fail: this is the entry point the home setup step
         * uses (`useHomeSetupSteps` calls this action directly rather than
         * `startCardOnboarding`), so it is reached with no gate having run at
         * all, and `resolveKycProvider` deliberately does not persist the
         * country it routes on.
         *
         * The selection screen writes `source: 'manual'` and re-enters the flow
         * via `/card/activate?countryConfirmed=true`, so this asks once.
         */
        if (useCountryStore.getState().countryInfo?.source !== 'manual') {
          track(TRACKING_EVENTS.CARD_KYC_FLOW_TRIGGERED, {
            action: 'country_selection_required',
            kycProvider,
            countryCode,
          });
          router.push(path.CARD_COUNTRY_SELECTION as any);
          return;
        }
      }

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
    kycStatus,
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
          depositRequired,
          minimumDepositUsd: cardStatusResponse?.minimumDepositUsd,
          cardCollateralDeposited: cardStatusResponse?.cardCollateralDeposited,
          savingsDepositMet,
          openSavingsDepositModal,
          rainForwardPendingDeposit: cardStatusResponse?.rainForwardPendingDeposit,
          submitPendingApplication,
          isSubmittingPendingApplication,
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
      depositRequired,
      cardStatusResponse?.minimumDepositUsd,
      cardStatusResponse?.cardCollateralDeposited,
      cardStatusResponse?.rainForwardPendingDeposit,
      savingsDepositMet,
      handleProceedToKyc,
      pushCardReady,
      pushCardDetails,
      cardIssuer,
      handleRainKYCPress,
      openSavingsDepositModal,
      submitPendingApplication,
      isSubmittingPendingApplication,
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
