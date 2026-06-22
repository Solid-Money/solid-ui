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
import { hasMetCardDeposit, requiresCardDeposit } from '@/lib/utils';

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
    /** KYC residence country (ISO alpha-2); enables the BD minimum-deposit step. */
    country?: string | null;
    /** Total collateral deposited to the card, in cents (BD users). */
    cardCollateralDeposited?: number | null;
    /** Opens the existing "deposit to card" popup. */
    openDepositModal?: () => void;
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
  const isKycComplete =
    options?.cardIssuer === CardProvider.RAIN
      ? isRainKycApproved
      : cardsEndorsement?.status === EndorsementStatus.APPROVED;

  const orderCardDesc = activationBlocked
    ? activationBlockedReason || 'There was an issue activating your card. Please contact support.'
    : 'All is set! Click on "Activate card" to review the agreements and issue your new card.';

  const kycStepOnPress =
    options?.cardIssuer === CardProvider.RAIN && options?.handleRainKYCPress
      ? options.handleRainKYCPress
      : handleProceedToKyc;

  // Bangladesh users must fund their card with a minimum collateral deposit
  // before spending. The step is inserted after "Activate your card" and is
  // marked complete from the summed positive Rain collateral the backend returns.
  const showDepositStep = requiresCardDeposit(options?.country);
  const cardDepositMet = hasMetCardDeposit(options?.cardCollateralDeposited);

  const steps: Omit<Step, 'id'>[] = [
    {
      title: 'Complete KYC',
      description,
      completed: isKycComplete || cardActivated,
      status: isKycComplete || cardActivated ? 'completed' : 'pending',
      endorsementStatus: cardsEndorsement?.status,
      buttonText,
      onPress: isButtonDisabled ? undefined : kycStepOnPress,
    },
    {
      title: 'Activate your card',
      description: orderCardDesc,
      completed: cardActivated,
      status: cardActivated ? 'completed' : 'pending',
      buttonText: activationBlocked || !isKycComplete ? undefined : 'Activate card',
      onPress: activationBlocked || !isKycComplete ? undefined : pushCardReady,
    },
  ];

  if (showDepositStep) {
    steps.push({
      title: `Deposit at least $${MINIMUM_CARD_DEPOSIT_USD}`,
      description: cardDepositMet
        ? 'Your card is funded — you’re ready to spend.'
        : `Add at least $${MINIMUM_CARD_DEPOSIT_USD} to your card to start spending.`,
      completed: cardDepositMet,
      status: cardDepositMet ? 'completed' : 'pending',
      // A card must be activated before it can be funded, so only offer the
      // deposit action once step 2 is done and the minimum isn't met yet.
      buttonText: cardActivated && !cardDepositMet ? 'Deposit' : undefined,
      onPress: cardActivated && !cardDepositMet ? options?.openDepositModal : undefined,
    });
  }

  steps.push({
    title: 'Start spending :)',
    description: 'Congratulations! your card is ready',
    buttonText: 'To the card',
    completed: false,
    status: cardActivated ? 'completed' : 'pending',
    onPress: pushCardDetails,
  });

  // Number steps by position so the indicator shows 1..N sequentially and the
  // activate step stays id 2 (used by the "Card creation pending" override).
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
    router.push(path.CARD_DETAILS);
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
