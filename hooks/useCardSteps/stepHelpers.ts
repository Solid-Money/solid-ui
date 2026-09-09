import { useCallback, useEffect, useState } from 'react';
import { Router } from 'expo-router';

import { EndorsementStatus } from '@/components/BankTransfer/enums';
import { MINIMUM_CARD_DEPOSIT_USD } from '@/constants/card';
import { path } from '@/constants/path';
import {
  BridgeCustomerEndorsement,
  BridgeRejectionReason,
  CardProvider,
  CardStatus,
  KycStatus,
  KycWarning,
  RainApplicationStatus,
} from '@/lib/types';
// Imported from the leaf module rather than the `@/lib/utils` barrel: the
// barrel pulls in AsyncStorage and the API client, neither of which loads under
// jest-expo, and this function is covered by buildCardSteps' own tests.
import { hasMetCardDeposit } from '@/lib/utils/cardDepositGate';

import { getStepButtonText, getStepDescription, isStepButtonDisabled } from './kycDisplayHelpers';
import { Step } from './types';

/**
 * Build the card activation steps array based on endorsement status (Bridge) or Rain KYC status
 */
export function buildCardSteps(
  cardsEndorsement: BridgeCustomerEndorsement | undefined,
  customerRejectionReasons: BridgeRejectionReason[] | undefined,
  cardActivated: boolean,
  activationBlocked: boolean | undefined,
  activationBlockedReason: string | undefined,
  handleProceedToKyc: () => void,
  pushCardReady: () => void,
  pushCardDetails: () => void,
  options?: {
    cardIssuer?: CardProvider | null;
    rainApplicationStatus?: RainApplicationStatus | null;
    kycStatus?: KycStatus | null;
    kycWarnings?: KycWarning[] | null;
    handleRainKYCPress?: () => void;
    /**
     * Whether to show the deposit steps at all. Already resolved by the caller
     * (see `requiresCardDeposit`), which prefers the backend's own answer and
     * falls back to the resolved issuer only while there is none.
     */
    depositRequired?: boolean;
    /** The savings minimum to ask for, in USD. Defaults to the app constant. */
    minimumDepositUsd?: number | null;
    /** Total collateral deposited to the card, in cents (legacy card-fund flow). */
    cardCollateralDeposited?: number | null;
    /** Whether the user holds at least the minimum in the savings (soUSD) vault. */
    savingsDepositMet?: boolean;
    /** Opens the deposit-to-savings (soUSD) flow used by the deposit steps. */
    openSavingsDepositModal?: () => void;
    /**
     * Verification passed but the application was parked because the deposit is
     * no longer held. Renders the `hold` step.
     */
    rainForwardPendingDeposit?: boolean;
    /** Submits the parked application (re-checks the balance server-side). */
    submitPendingApplication?: () => void;
    /** Whether {@link submitPendingApplication} is in flight. */
    isSubmittingPendingApplication?: boolean;
  },
): Step[] {
  const stepOptions =
    options?.cardIssuer != null || options?.kycStatus != null
      ? {
          cardIssuer: options?.cardIssuer,
          rainApplicationStatus: options?.rainApplicationStatus,
          kycStatus: options?.kycStatus,
          kycWarnings: options?.kycWarnings,
        }
      : undefined;
  const description = getStepDescription(cardsEndorsement, customerRejectionReasons, stepOptions);
  const buttonText = getStepButtonText(cardsEndorsement, stepOptions);
  const isButtonDisabled = isStepButtonDisabled(cardsEndorsement, stepOptions);

  const isRainKycApproved =
    options?.cardIssuer === CardProvider.RAIN &&
    options?.rainApplicationStatus === RainApplicationStatus.APPROVED;
  // Wirex has no Bridge endorsement and no Rain application, so it must key off
  // the canonical backend kycStatus. Without this branch it fell through to the
  // endorsement check, which is a Bridge concept that never exists for a Wirex
  // user — leaving isKycComplete permanently false, so the KYC step stayed open
  // and "Activate your card" never became enabled even once Wirex had approved.
  const isKycComplete =
    options?.cardIssuer === CardProvider.RAIN
      ? isRainKycApproved
      : // Deliberately NOT gated on cardIssuer === WIREX: /cards/status does not
        // return cardProvider, so cardIssuer is null for Wirex users and a
        // provider-specific branch never matched — leaving the step incomplete
        // and the activate button unrendered even with kycStatus "approved".
        // kycStatus is the canonical backend decision for every non-Rain issuer,
        // with the Bridge endorsement kept as the legacy fallback.
        options?.kycStatus === KycStatus.APPROVED ||
        cardsEndorsement?.status === EndorsementStatus.APPROVED;

  const orderCardDesc = activationBlocked
    ? activationBlockedReason || 'There was an issue activating your card. Please contact support.'
    : 'All is set! Click on "Activate card" to review the agreements and issue your new card.';

  const kycStepOnPress =
    options?.cardIssuer === CardProvider.RAIN && options?.handleRainKYCPress
      ? options.handleRainKYCPress
      : handleProceedToKyc;

  // Every applicant on the Rain flow must deposit before they can start KYC or
  // activate a card, so this step is placed FIRST — ahead of KYC and activation.
  // That way we never pay for a Didit (~$1) or Rain (~$2.50) verification, nor
  // issue a card, for someone who has funded nothing. No card exists at this
  // point, so the money goes into the savings (soUSD) vault; the user moves it
  // onto the card later via "Deposit to card".
  //
  // The step completes once the savings minimum is met and stays complete
  // afterwards (card activated, or legacy card collateral funded) so later
  // moving funds out to the card doesn't reopen it. What DOES reopen the
  // requirement is the `hold` step below, and only in the window where it
  // matters: between verification passing and the application being submitted.
  const minimumDepositUsd = options?.minimumDepositUsd ?? MINIMUM_CARD_DEPOSIT_USD;
  const showDepositStep = Boolean(options?.depositRequired);
  // The applicant deposited, cleared step one, and then sent or withdrew the
  // money before their verification came back — so the application was never
  // submitted. This step asks them to put it back and hold it, and its action is
  // what submits the application. It exists only while that is true: the backend
  // sets `rainForwardPendingDeposit` and clears it the moment a submission
  // lands, so this cannot linger for someone who is already through.
  const showHoldStep = showDepositStep && Boolean(options?.rainForwardPendingDeposit);
  const holdSatisfied = Boolean(options?.savingsDepositMet);

  // Reaching the parked state is itself proof the first step was cleared —
  // nothing gets a verification session without passing this gate server-side.
  // So the first step stays done and the live "put it back" ask lives in the
  // `hold` step alone, rather than two steps asking for the same deposit and the
  // reopened first one disabling the second one's button.
  const depositMet =
    Boolean(options?.savingsDepositMet) ||
    showHoldStep ||
    cardActivated ||
    hasMetCardDeposit(options?.cardCollateralDeposited);

  // While the application is parked, the ID check itself is DONE — what is
  // outstanding is the deposit, and the `hold` step below is where the user acts
  // on it. Showing this step as still open would be wrong twice over: it reads
  // as "your ID check failed", and its button offers to start verification
  // again, which restarts a Didit session we would be charged for a second time.
  //
  // Deliberately kept apart from `isKycComplete`, which still gates activation:
  // the issuer has not approved anything yet, so "Activate card" must stay shut.
  const kycStepComplete = isKycComplete || cardActivated || showHoldStep;

  const kycStep: Omit<Step, 'id'> = {
    key: 'kyc',
    title: 'Complete KYC',
    description: showHoldStep
      ? 'Your ID check passed. One thing left before we submit your application — see below.'
      : description,
    completed: kycStepComplete,
    status: kycStepComplete ? 'completed' : 'pending',
    endorsementStatus: cardsEndorsement?.status,
    buttonText: showHoldStep ? undefined : buttonText,
    onPress: showHoldStep || isButtonDisabled ? undefined : kycStepOnPress,
  };

  const activateStep: Omit<Step, 'id'> = {
    key: 'activate',
    title: 'Activate your card',
    description: orderCardDesc,
    completed: cardActivated,
    status: cardActivated ? 'completed' : 'pending',
    buttonText: activationBlocked || !isKycComplete ? undefined : 'Activate card',
    onPress: activationBlocked || !isKycComplete ? undefined : pushCardReady,
  };

  const steps: Omit<Step, 'id'>[] = [];

  if (showDepositStep) {
    steps.push({
      key: 'deposit',
      title: `Deposit at least $${minimumDepositUsd}`,
      description: depositMet
        ? `Your $${minimumDepositUsd}+ is safe in savings (soUSD). When your card is ready you can move it over with “Deposit to card”.`
        : `Add at least $${minimumDepositUsd} to continue. Your card isn’t created yet, so these funds go into your savings vault (soUSD) — not onto the card. Once the card is ready you can move them over anytime with “Deposit to card”.`,
      completed: depositMet,
      status: depositMet ? 'completed' : 'pending',
      // Deposits go to savings, which needs no card, so the action is available
      // immediately (unlike the old step, which could only fund an issued card).
      buttonText: depositMet ? undefined : 'Deposit',
      onPress: depositMet ? undefined : options?.openSavingsDepositModal,
    });
  }

  // KYC and activation follow the deposit gate. Sequential step navigation
  // (useStepNavigation) only enables a step's button once every preceding step
  // is complete, so placing deposit first blocks KYC/activation until it's met.
  steps.push(kycStep);

  if (showHoldStep) {
    steps.push({
      key: 'hold',
      title: `Top up and hold your $${minimumDepositUsd}`,
      description: holdSatisfied
        ? `Your savings are back above $${minimumDepositUsd}. Submit your application to continue — we’ll check your balance one more time as we send it.`
        : `Your ID check passed, but your savings dropped below $${minimumDepositUsd} before we could submit your application. Deposit again and keep it in savings (soUSD) — it stays yours and earns yield, and you can move it onto the card once it’s ready.`,
      // Never "completed": this step exists only while the application is still
      // parked, and disappears once the backend reports it submitted. Marking it
      // done while it is still showing would let the activation step below open
      // behind an application that was never sent.
      completed: false,
      status: 'pending',
      buttonText: holdSatisfied ? 'Submit application' : 'Deposit',
      onPress: holdSatisfied ? options?.submitPendingApplication : options?.openSavingsDepositModal,
      isLoading: options?.isSubmittingPendingApplication,
    });
  }

  steps.push(activateStep);

  steps.push({
    key: 'spend',
    title: 'Start spending :)',
    description: 'Congratulations! your card is ready',
    buttonText: 'To the card',
    completed: false,
    status: cardActivated ? 'completed' : 'pending',
    onPress: pushCardDetails,
  });

  // Number steps by position so the indicator shows 1..N sequentially. Consumers
  // that need a specific step key off `key`, not `id`.
  return steps.map((step, index) => ({ ...step, id: index + 1 }));
}

/**
 * Find the first incomplete step in a list of steps
 */
export function findFirstIncompleteStep(steps: Step[]): Step | undefined {
  return steps.find((step, index) => {
    const allPrecedingCompleted = steps.slice(0, index).every(s => s.completed);
    return !step.completed && allPrecedingCompleted;
  });
}

/**
 * Hook to manage card activation state and actions.
 * Card creation itself happens on /card/ready after the user accepts the
 * consents; this hook only tracks completion state and exposes navigation.
 */
export function useCardActivation(router: Router) {
  const [cardActivated, setCardActivated] = useState(false);
  const [activatingCard] = useState(false);

  const syncCardActivationState = useCallback((cardStatus: CardStatus | undefined) => {
    // Mark card as activated if user has a card in any state
    if (
      cardStatus === CardStatus.ACTIVE ||
      cardStatus === CardStatus.FROZEN ||
      cardStatus === CardStatus.INACTIVE
    ) {
      setCardActivated(true);
    }
  }, []);

  const pushCardDetails = useCallback(() => {
    router.navigate(path.CARD_INFO);
  }, [router]);

  const pushCardReady = useCallback(() => {
    router.push(path.CARD_READY);
  }, [router]);

  return {
    cardActivated,
    activatingCard,
    syncCardActivationState,
    pushCardDetails,
    pushCardReady,
  };
}

/**
 * Hook to manage step navigation state
 */
export function useStepNavigation(steps: Step[]) {
  const [activeStepId, setActiveStepId] = useState<number | null>(null);

  // Set default active step on mount
  useEffect(() => {
    const firstIncompleteStep = findFirstIncompleteStep(steps);
    if (firstIncompleteStep && activeStepId !== firstIncompleteStep.id) {
      setActiveStepId(firstIncompleteStep.id);
    }
  }, [steps, activeStepId]);

  const isStepButtonEnabled = useCallback(
    (stepIndex: number) => {
      const currentStep = steps[stepIndex];
      // Button is disabled if step has no onPress handler (already handled by isStepButtonDisabled)
      if (!currentStep?.onPress) {
        return false;
      }
      return steps.slice(0, stepIndex).every(step => step.completed);
    },
    [steps],
  );

  const getFirstIncompleteStep = useCallback(() => findFirstIncompleteStep(steps), [steps]);

  const canToggleStep = useCallback(
    (stepId: number) => {
      if (activeStepId === stepId) return true;
      if (activeStepId === null) {
        const firstIncompleteStep = getFirstIncompleteStep();
        return firstIncompleteStep?.id === stepId;
      }
      return false;
    },
    [activeStepId, getFirstIncompleteStep],
  );

  const toggleStep = useCallback(
    (stepId: number) => {
      if (activeStepId === stepId) {
        setActiveStepId(null);
      } else if (activeStepId === null) {
        const firstIncompleteStep = getFirstIncompleteStep();
        if (firstIncompleteStep?.id === stepId) {
          setActiveStepId(stepId);
        }
      }
    },
    [activeStepId, getFirstIncompleteStep],
  );

  return {
    activeStepId,
    isStepButtonEnabled,
    canToggleStep,
    toggleStep,
  };
}
