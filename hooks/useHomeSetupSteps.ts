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
    // Look these up by key, not index: for deposit-required (BD) users the card
    // flow now leads with a "deposit first" step, so KYC/activate aren't at
    // fixed positions anymore.
    const kycStep = cardSteps.find(step => step.key === 'kyc');
    const cardStep = cardSteps.find(step => step.key === 'activate');

    const openDeposit = () => useDepositStore.getState().setModal(DEPOSIT_MODAL.OPEN_OPTIONS);
    // Card onboarding starts at country selection (same entry ReserveCardButton and
    // useCountryCheck use). These steps used to fall back to `/card`, the deprecated
    // waitlist page — and they fall back often: `activate` has no onPress until KYC
    // is complete, and `kyc` has none while its button is disabled.
    const startCardOnboarding = () => router.push(path.CARD_COUNTRY_SELECTION);

    const steps: HomeSetupStep[] = [
      {
        title: 'Verify your identity',
        description: '3 min to unlock all features',
        cta: 'Verify your identity',
        completed: Boolean(kycStep?.completed),
        onPress: kycStep?.onPress ?? startCardOnboarding,
      },
      {
        title: 'Get your free virtual card',
        description: 'Global payments, cashback and more',
        cta: 'Get your card',
        completed: Boolean(cardStep?.completed),
        // No activate action means KYC isn't done yet, so send them to that instead.
        onPress: cardStep?.onPress ?? kycStep?.onPress ?? startCardOnboarding,
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
