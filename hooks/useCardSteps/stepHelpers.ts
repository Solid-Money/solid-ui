import { path } from '@/constants/path';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { track } from '@/lib/analytics';
import { createCard } from '@/lib/api';
import { CardStatus, KycStatus } from '@/lib/types';
import { withRefreshToken } from '@/lib/utils';
import { Router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import Toast from 'react-native-toast-message';
import { extractCardActivationErrorMessage } from './cardActivationHelpers';
import { getKycButtonText, getKycDescription } from './kycDisplayHelpers';
import { Step } from './types';

/**
 * Build the card activation steps array
 */
export function buildCardSteps(
  uiKycStatus: KycStatus,
  cardActivated: boolean,
  activationBlocked: boolean | undefined,
  activationBlockedReason: string | undefined,
  rejectionReasonsText: string | undefined,
  handleProceedToKyc: () => void,
  handleActivateCard: () => void,
  pushCardDetails: () => void,
): Step[] {
  const description = getKycDescription(uiKycStatus, rejectionReasonsText);
  const buttonText = getKycButtonText(uiKycStatus);

  const orderCardDesc = activationBlocked
    ? activationBlockedReason || 'There was an issue activating your card. Please contact support.'
    : 'All is set! now click on the "Create card" button to issue your new card';

  const isKycBlocked =
    uiKycStatus === KycStatus.UNDER_REVIEW || uiKycStatus === KycStatus.OFFBOARDED;

  return [
    {
      id: 1,
      title: 'Complete KYC',
      description,
      completed: uiKycStatus === KycStatus.APPROVED || cardActivated,
      status: uiKycStatus === KycStatus.APPROVED || cardActivated ? 'completed' : 'pending',
      kycStatus: uiKycStatus,
      buttonText,
      onPress: isKycBlocked ? undefined : handleProceedToKyc,
    },
    {
      id: 2,
      title: 'Order your card',
      description: orderCardDesc,
      completed: cardActivated,
      status: cardActivated ? 'completed' : 'pending',
      buttonText: activationBlocked ? undefined : 'Order card',
      onPress: activationBlocked ? undefined : handleActivateCard,
    },
    {
      id: 3,
      title: 'Start spending :)',
      description: 'Congratulations! your card is ready',
      buttonText: 'To the card',
      completed: false,
      status: cardActivated ? 'completed' : 'pending',
      onPress: pushCardDetails,
    },
  ];
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
 * Hook to manage card activation state and actions
 */
export function useCardActivation(router: Router) {
  const [cardActivated, setCardActivated] = useState(false);
  const [activatingCard, setActivatingCard] = useState(false);

  const handleActivateCard = useCallback(async () => {
    track(TRACKING_EVENTS.CARD_ACTIVATION_STARTED);
    try {
      setActivatingCard(true);
      const card = await withRefreshToken(() => createCard());

      if (!card) throw new Error('Failed to create card');

      setCardActivated(true);
      track(TRACKING_EVENTS.CARD_ACTIVATION_SUCCEEDED, { cardId: card.id });
      router.replace(path.CARD_DETAILS);
    } catch (error) {
      console.error('Error activating card:', error);
      const errorMessage = await extractCardActivationErrorMessage(error);

      track(TRACKING_EVENTS.CARD_ACTIVATION_FAILED, { message: errorMessage });
      Toast.show({
        type: 'error',
        text1: 'Error activating card',
        text2: errorMessage,
        props: { badgeText: '' },
      });
    } finally {
      setActivatingCard(false);
    }
  }, [router]);

  const syncCardActivationState = useCallback((cardStatus: CardStatus | undefined) => {
    if (cardStatus === CardStatus.ACTIVE || cardStatus === CardStatus.FROZEN) {
      setCardActivated(true);
    }
  }, []);

  const pushCardDetails = useCallback(() => {
    router.push(path.CARD_DETAILS);
  }, [router]);

  return {
    cardActivated,
    activatingCard,
    handleActivateCard,
    syncCardActivationState,
    pushCardDetails,
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
      if (
        currentStep?.kycStatus === KycStatus.UNDER_REVIEW ||
        currentStep?.kycStatus === KycStatus.OFFBOARDED
      ) {
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
