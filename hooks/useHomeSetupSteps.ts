import { useMemo } from 'react';
import { useRouter } from 'expo-router';

import { DEPOSIT_MODAL } from '@/constants/modals';
import { path } from '@/constants/path';
import { useCardStatus } from '@/hooks/useCardStatus';
import { useCardSteps } from '@/hooks/useCardSteps';
import { isKycAwaitingDecision } from '@/lib/utils/kyc/verificationProgress';
import { useDepositStore } from '@/store/useDepositStore';

export interface HomeSetupStep {
  /** Stable identifier — callers gate on this rather than matching on `title`. */
  key: 'kyc' | 'card' | 'deposit';
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
    // Look these up by key, not index: the card flow leads with a "deposit
    // first" step for gated applicants and can grow a "deposit and hold" step
    // after it, so KYC/activate aren't at fixed positions anymore.
    const kycStep = cardSteps.find(step => step.key === 'kyc');
    const cardStep = cardSteps.find(step => step.key === 'activate');
    // Whether the card flow is currently blocked on the minimum savings deposit
    // — either the first step is unmet, or an approved verification is parked
    // waiting for the money to come back.
    //
    // This card is a side entrance: it invokes each step's action directly and
    // so does NOT inherit the activation screen's sequential gating, which is
    // what stops KYC being started before the deposit is in. Without this check,
    // "Verify your identity" from here opens a verification the backend refuses,
    // and the user meets the requirement as an error rather than as a step.
    //
    // These CTAs deliberately route into the card flow rather than firing the
    // deposit action from here: the step's own copy is what explains why money
    // is being asked for, and a bare deposit sheet under a button labelled
    // "Verify your identity" explains nothing.
    const blockedOnDeposit = cardSteps.some(
      step => (step.key === 'deposit' || step.key === 'hold') && !step.completed,
    );

    const openDeposit = () => useDepositStore.getState().setModal(DEPOSIT_MODAL.OPEN_OPTIONS);
    // Card onboarding starts at country selection (same entry ReserveCardButton and
    // useCountryCheck use). These steps used to fall back to `/card`, the deprecated
    // waitlist page — and they fall back often: `activate` has no onPress until KYC
    // is complete, and `kyc` has none while its button is disabled.
    //
    // "While its button is disabled" includes a verification that is submitted and
    // waiting on a decision, and for that case country selection is the wrong
    // fallback in both directions: it restarts onboarding the applicant finished,
    // and the KYC session it leads to is refused once a provider consumer exists.
    // The issuance screen is where that state belongs — it renders "your card is
    // on its way".
    const startCardOnboarding = () =>
      router.push(
        isKycAwaitingDecision(cardStatus) ? path.CARD_ACTIVATE : path.CARD_COUNTRY_SELECTION,
      );

    const steps: HomeSetupStep[] = [
      {
        key: 'kyc',
        title: 'Verify your identity',
        description: '3 min to unlock all features',
        cta: 'Verify your identity',
        completed: Boolean(kycStep?.completed),
        onPress: (blockedOnDeposit ? undefined : kycStep?.onPress) ?? startCardOnboarding,
      },
      {
        key: 'card',
        title: 'Get your free virtual card',
        description: 'Global payments, cashback and more',
        cta: 'Get your card',
        completed: Boolean(cardStep?.completed),
        // No activate action means KYC isn't done yet, so send them to that instead.
        onPress:
          cardStep?.onPress ??
          (blockedOnDeposit ? undefined : kycStep?.onPress) ??
          startCardOnboarding,
      },
      {
        key: 'deposit',
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
  }, [cardSteps, cardStatus, depositCompleted, router]);
}
