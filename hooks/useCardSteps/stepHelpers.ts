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
    /** Residence country (ISO alpha-2); enables the BD minimum-deposit step. */
    country?: string | null;
    /** Total collateral deposited to the card, in cents (legacy BD card-fund flow). */
    cardCollateralDeposited?: number | null;
    /** Whether the user holds at least the $5 minimum in the savings (soUSD) vault. */
    savingsDepositMet?: boolean;
    /** Opens the deposit-to-savings (soUSD) flow used by the BD first step. */
    openSavingsDepositModal?: () => void;
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

  // Bangladesh users must deposit before they can start KYC or activate a card,
  // so this step is placed FIRST — ahead of KYC and activation. That way we
  // never pay for a Didit/Rain KYC or issue a card for someone who hasn't funded
  // anything. No card exists at this point, so the money goes into the savings
  // (soUSD) vault; the user moves it onto the card later via "Deposit to card".
  // The step completes once the savings minimum is met and stays complete
  // afterwards (card activated, or legacy card collateral funded) so later
  // moving funds out to the card doesn't reopen it.
  const showDepositStep = requiresCardDeposit(options?.country);
  const depositMet =
    Boolean(options?.savingsDepositMet) ||
    cardActivated ||
    hasMetCardDeposit(options?.cardCollateralDeposited);

  const kycStep: Omit<Step, 'id'> = {
    key: 'kyc',
    title: 'Complete KYC',
    description,
    completed: isKycComplete || cardActivated,
    status: isKycComplete || cardActivated ? 'completed' : 'pending',
    endorsementStatus: cardsEndorsement?.status,
    buttonText,
    onPress: isButtonDisabled ? undefined : kycStepOnPress,
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
      title: `Deposit at least $${MINIMUM_CARD_DEPOSIT_USD}`,
      description: depositMet
        ? `Your $${MINIMUM_CARD_DEPOSIT_USD}+ is safe in savings (soUSD). When your card is ready you can move it over with “Deposit to card”.`
        : `Add at least $${MINIMUM_CARD_DEPOSIT_USD} to continue. Your card isn’t created yet, so these funds go into your savings vault (soUSD) — not onto the card. Once the card is ready you can move them over anytime with “Deposit to card”.`,
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
  steps.push(kycStep, activateStep);

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
