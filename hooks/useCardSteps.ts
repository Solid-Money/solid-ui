import { Endorsements } from '@/components/BankTransfer/enums';
import { KycMode } from '@/components/UserKyc';
import { path } from '@/constants/path';
import { createCard, getKycLinkFromBridge } from '@/lib/api';
import { KycStatus } from '@/lib/types';
import { withRefreshToken } from '@/lib/utils';
import { startKycFlow } from '@/lib/utils/kyc';
import { useKycStore } from '@/store/useKycStore';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Toast from 'react-native-toast-message';
import { useKycLinkFromBridge } from './useCustomer';

interface Step {
  id: number;
  title: string;
  description?: string;
  completed: boolean;
  buttonText?: string;
  onPress?: () => void;
  // Generic UI progress state for a step
  status?: 'pending' | 'completed';
  // Specific KYC status for step 1
  kycStatus?: KycStatus;
}

function getKycDescription(kycStatus: KycStatus, rejectionReasonsText?: string) {
  if (kycStatus === KycStatus.REJECTED) {
    return (
      rejectionReasonsText ||
      'We couldn’t verify your identity. Please review the issues and try again.'
    );
  }
  if (kycStatus === KycStatus.PAUSED) {
    return 'KYC paused. Please retry to continue.';
  }
  if (kycStatus === KycStatus.OFFBOARDED) {
    return 'Your account has been offboarded. Please contact support.';
  }
  return 'Identity verification required for us to issue your card';
}

function getKycButtonText(kycStatus: KycStatus): string | undefined {
  if (kycStatus === KycStatus.UNDER_REVIEW) return 'Under Review';
  if (kycStatus === KycStatus.REJECTED) return 'Retry KYC';
  if (kycStatus === KycStatus.PAUSED) return 'Retry KYC';
  if (kycStatus === KycStatus.OFFBOARDED) return undefined;
  return 'Complete KYC';
}

export function useCardSteps(initialKycStatus?: KycStatus) {
  const [activeStepId, setActiveStepId] = useState<number | null>(null);
  const [cardActivated, setCardActivated] = useState(false);
  const [activatingCard, setActivatingCard] = useState(false);

  const router = useRouter();
  const { kycLinkId } = useKycStore();

  console.warn('[CardSteps] kycLinkId', kycLinkId);

  // Get KYC link status if KYC link ID exists
  const { data: kycLink } = useKycLinkFromBridge(kycLinkId || undefined);

  console.warn('[CardSteps] kycLink', kycLink);

  // Determine KYC status from multiple sources.
  // Prefer live link status; fall back to initial (optimistic) status.
  const kycStatus = useMemo(() => {
    if (kycLink?.kyc_status) {
      return (kycLink.kyc_status as KycStatus) || KycStatus.UNDER_REVIEW;
    }
    if (initialKycStatus) {
      return initialKycStatus;
    }
    return KycStatus.NOT_STARTED;
  }, [kycLink?.kyc_status, initialKycStatus]);

  console.warn('[CardSteps] computed kycStatus', {
    kycLinkId,
    linkStatus: (kycLink as any)?.kyc_status,
    initialKycStatus,
    computed: kycStatus,
  });

  const rejectionReasonsText = useMemo(() => {
    if (kycStatus !== KycStatus.REJECTED) return undefined;
    const reasons = (kycLink as any)?.rejection_reasons;
    if (!reasons || !Array.isArray(reasons) || reasons.length === 0) return undefined;
    try {
      const items = reasons
        .map((r: any) => (typeof r === 'string' ? r : r?.reason))
        .filter((r: any) => typeof r === 'string' && r.trim().length > 0);
      if (!items.length) return undefined;
      return `We couldn’t verify your identity:\n- ${items.join('\n- ')}`;
    } catch {
      return undefined;
    }
  }, [kycStatus, kycLink]);

  const handleProceedToKyc = useCallback(async () => {
    try {
      // Fetch latest KYC status if we have a link id
      if (kycLinkId) {
        const latest = await withRefreshToken(() => getKycLinkFromBridge(kycLinkId));
        const latestStatus = (latest?.kyc_status as KycStatus) || KycStatus.NOT_STARTED;

        if (latestStatus === KycStatus.UNDER_REVIEW) {
          Toast.show({
            type: 'info',
            text1: 'KYC under review',
            text2: 'Please wait while we complete the review.',
            props: { badgeText: '' },
          });
          return;
        }

        if (latestStatus === KycStatus.APPROVED) {
          Toast.show({
            type: 'success',
            text1: 'KYC approved',
            text2: 'You can proceed to order your card.',
            props: { badgeText: '' },
          });
          return;
        }

        if (latestStatus === KycStatus.OFFBOARDED) {
          Toast.show({
            type: 'error',
            text1: 'Account offboarded',
            text2: 'Please contact support for assistance.',
            props: { badgeText: '' },
          });
          return;
        }
      }
    } catch (_e) {
      // If status check fails, we still allow starting KYC flow
    }

    const baseUrl = process.env.EXPO_PUBLIC_BASE_URL;
    const redirectUri = `${baseUrl}${path.CARD_ACTIVATE}?kycStatus=${KycStatus.UNDER_REVIEW}`;

    // If we already have an existing KYC link, start the flow directly using it
    if (kycLink?.kyc_link) {
      try {
        const urlObj = new URL(kycLink.kyc_link);
        // Ensure redirect-uri is present for post-completion navigation (mainly for web)
        if (!urlObj.searchParams.has('redirect-uri') && !urlObj.searchParams.has('redirect_uri')) {
          urlObj.searchParams.set('redirect-uri', redirectUri);
        }
        startKycFlow({ router, kycLink: urlObj.toString() });
        return;
      } catch (_e) {
        // Fall through to user-kyc-info if URL parsing fails
      }
    }

    const params = new URLSearchParams({
      kycMode: KycMode.CARD,
      endorsement: Endorsements.CARDS,
      redirectUri,
    }).toString();

    router.push(`/user-kyc-info?${params}`);
  }, [router, kycLinkId, kycLink?.kyc_link]);

  const handleActivateCard = useCallback(async () => {
    try {
      setActivatingCard(true);
      const card = await withRefreshToken(() => createCard());

      if (!card) throw new Error('Failed to create card');

      console.warn('Card created:', card);
      setCardActivated(true);

      // Navigate to card details
      router.replace(path.CARD_DETAILS);
    } catch (error) {
      console.error('Error activating card:', error);
      // Show error toast
      Toast.show({
        type: 'error',
        text1: 'Error activating card',
        text2: 'Please try again',
        props: {
          badgeText: '',
        },
      });
    } finally {
      setActivatingCard(false);
    }
  }, [router]);

  const steps: Step[] = useMemo(() => {
    const description = getKycDescription(kycStatus, rejectionReasonsText);
    const buttonText = getKycButtonText(kycStatus);

    return [
      {
        id: 1,
        title: 'Complete KYC',
        description: description,
        completed: kycStatus === KycStatus.APPROVED || cardActivated,
        status: kycStatus === KycStatus.APPROVED || cardActivated ? 'completed' : 'pending',
        kycStatus: kycStatus,
        buttonText: buttonText,
        onPress:
          kycStatus === KycStatus.UNDER_REVIEW || kycStatus === KycStatus.OFFBOARDED
            ? undefined
            : handleProceedToKyc,
      },
      {
        id: 2,
        title: 'Order your card',
        description: 'All is set! now click on the "Create card" button to issue your new card',
        completed: cardActivated,
        status: cardActivated ? 'completed' : 'pending',
        buttonText: 'Order card',
        onPress: handleActivateCard,
      },
      {
        id: 3,
        title: 'Start spending :)',
        description: 'Congratulations! your card is ready',
        buttonText: 'To the card',
        completed: cardActivated,
        status: cardActivated ? 'completed' : 'pending',
        onPress: () => router.push(path.CARD_DETAILS),
      },
    ];
  }, [
    kycStatus,
    cardActivated,
    handleProceedToKyc,
    handleActivateCard,
    router,
    rejectionReasonsText,
  ]);

  // Set default active step on mount
  useEffect(() => {
    const firstIncompleteStep = steps.find((step, index) => {
      const allPrecedingCompleted = steps.slice(0, index).every(s => s.completed);
      return !step.completed && allPrecedingCompleted;
    });

    if (firstIncompleteStep) {
      setActiveStepId(firstIncompleteStep.id);
    }
  }, [steps]);

  // Check if a step's button should be enabled
  const isStepButtonEnabled = (_stepIndex: number) => {
    const currentStep = steps[_stepIndex];
    if (
      currentStep?.kycStatus === KycStatus.UNDER_REVIEW ||
      currentStep?.kycStatus === KycStatus.OFFBOARDED
    ) {
      return false;
    }

    return steps.slice(0, _stepIndex).every(step => step.completed);
  };

  const toggleStep = (stepId: number) => {
    setActiveStepId(activeStepId === stepId ? null : stepId);
  };

  return {
    steps,
    activeStepId,
    isStepButtonEnabled,
    toggleStep,
    activatingCard,
  };
}
