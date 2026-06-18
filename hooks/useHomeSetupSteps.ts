import { useMemo } from 'react';
import { useRouter } from 'expo-router';

import { DEPOSIT_MODAL } from '@/constants/modals';
import { path } from '@/constants/path';
import { useCardStatus } from '@/hooks/useCardStatus';
import { useCardSteps } from '@/hooks/useCardSteps';
import { useDepositStore } from '@/store/useDepositStore';

export interface HomeSetupStep {
  title: string;
  description: string;
  /** Short label used on the primary CTA button when this is the next step */
  cta: string;
  completed: boolean;
  onPress?: () => void;
}

export interface HomeSetupStepsResult {
  steps: HomeSetupStep[];
  completedCount: number;
  total: number;
  firstIncomplete?: HomeSetupStep;
}

/**
 * Builds the three onboarding steps shown on the native home "Finish setting up"
 * card and modal: verify identity, get the virtual card, and top up the balance.
 *
 * Completion + the KYC / card-activation actions are sourced from the existing
 * `useCardSteps` flow so we reuse the canonical (Bridge/Rain aware) routing.
 *
 * @param depositCompleted whether the user has already funded their account
 */
export function useHomeSetupSteps(depositCompleted: boolean): HomeSetupStepsResult {
  const router = useRouter();
  const { data: cardStatus } = useCardStatus();
  const { steps: cardSteps } = useCardSteps(cardStatus?.kycStatus, cardStatus);

  return useMemo(() => {
    const kycStep = cardSteps[0];
    const cardStep = cardSteps[1];

    const openDeposit = () => useDepositStore.getState().setModal(DEPOSIT_MODAL.OPEN_OPTIONS);

    const steps: HomeSetupStep[] = [
      {
        title: 'Verify your identity',
        description: '3 min to unlock all features',
        cta: 'Verify your identity',
        completed: Boolean(kycStep?.completed),
        onPress: kycStep?.onPress ?? (() => router.push(path.CARD)),
      },
      {
        title: 'Get your free virtual card',
        description: 'Global payments, cashback and more',
        cta: 'Get your card',
        completed: Boolean(cardStep?.completed),
        onPress: cardStep?.onPress ?? (() => router.push(path.CARD)),
      },
      {
        title: 'Top up your balance',
        description: 'Via bank transfers or crypto',
        cta: 'Top up your balance',
        completed: depositCompleted,
        onPress: openDeposit,
      },
    ];

    const completedCount = steps.filter(step => step.completed).length;
    const firstIncomplete = steps.find(step => !step.completed);

    return { steps, completedCount, total: steps.length, firstIncomplete };
  }, [cardSteps, depositCompleted, router]);
}
