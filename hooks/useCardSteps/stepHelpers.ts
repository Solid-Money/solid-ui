import { useCallback, useEffect, useState } from 'react';
import Toast from 'react-native-toast-message';
import { Router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';

import { EndorsementStatus } from '@/components/BankTransfer/enums';
import { path } from '@/constants/path';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { CARD_STATUS_QUERY_KEY } from '@/hooks/useCardStatus';
import { useFingerprint } from '@/hooks/useFingerprint';
import { track } from '@/lib/analytics';
import { createCard, observeFingerprint } from '@/lib/api';
import {
  BridgeCustomerEndorsement,
  BridgeRejectionReason,
  CardProvider,
  CardStatus,
  RainApplicationStatus,
} from '@/lib/types';
import { withRefreshToken } from '@/lib/utils';

import { extractCardActivationErrorMessage } from './cardActivationHelpers';
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
  handleActivateCard: () => void,
  pushCardDetails: () => void,
  options?: {
    cardIssuer?: CardProvider | null;
    rainApplicationStatus?: RainApplicationStatus | null;
    handleRainKYCPress?: () => void;
  },
): Step[] {
  const stepOptions =
    options?.cardIssuer != null
      ? {
          cardIssuer: options.cardIssuer,
          rainApplicationStatus: options.rainApplicationStatus,
        }
      : undefined;
  const description = getStepDescription(
    cardsEndorsement,
    customerRejectionReasons,
    stepOptions,
  );
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
    : 'All is set! now click on the "Create card" button to issue your new card';

  const kycStepOnPress =
    options?.cardIssuer === CardProvider.RAIN && options?.handleRainKYCPress
      ? options.handleRainKYCPress
      : handleProceedToKyc;

  return [
    {
      id: 1,
      title: 'Complete KYC',
      description,
      completed: isKycComplete || cardActivated,
      status: isKycComplete || cardActivated ? 'completed' : 'pending',
      endorsementStatus: cardsEndorsement?.status,
      buttonText,
      onPress: isButtonDisabled ? undefined : kycStepOnPress,
    },
    {
      id: 2,
      title: 'Order your card',
      description: orderCardDesc,
      completed: cardActivated,
      status: cardActivated ? 'completed' : 'pending',
      buttonText: activationBlocked || !isKycComplete ? undefined : 'Order card',
      onPress: activationBlocked || !isKycComplete ? undefined : handleActivateCard,
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
  const queryClient = useQueryClient();
  const [cardActivated, setCardActivated] = useState(false);
  const [activatingCard, setActivatingCard] = useState(false);
  const { getVisitorData, isAvailable: isFingerprintAvailable } = useFingerprint();

  const handleActivateCard = useCallback(async () => {
    track(TRACKING_EVENTS.CARD_ACTIVATION_STARTED);
    try {
      setActivatingCard(true);

      // Step 1: Observe fingerprint before card creation (for duplicate detection)
      if (isFingerprintAvailable) {
        const visitorData = await getVisitorData();
        if (visitorData?.requestId) {
          try {
            await withRefreshToken(() =>
              observeFingerprint({
                requestId: visitorData.requestId,
                context: 'create_card',
              }),
            );
          } catch (fingerprintError) {
            // Log but don't block card creation if fingerprint observation fails
            // The backend will handle missing visitorId appropriately
            console.warn('[Card Activation] Failed to observe fingerprint:', fingerprintError);
          }
        }
      }

      // Step 2: Create the card
      const card = await withRefreshToken(() => createCard());

      if (!card) throw new Error('Failed to create card');

      if (card.status !== CardStatus.PENDING) {
        setCardActivated(true);
        track(TRACKING_EVENTS.CARD_ACTIVATION_SUCCEEDED, { cardId: card.id });
        router.replace(path.CARD_DETAILS);
      } else {
        // If card is pending, we don't mark as activated and don't redirect.
        // We just invalidate the card status to show the "pending" UI on the same page.
        queryClient.invalidateQueries({ queryKey: [CARD_STATUS_QUERY_KEY] });
      }
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
  }, [router, queryClient, getVisitorData, isFingerprintAvailable]);

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
