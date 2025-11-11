import { Endorsements } from '@/components/BankTransfer/enums';
import { KycMode } from '@/components/UserKyc';
import { path } from '@/constants/path';
import { createCard, getKycLinkFromBridge } from '@/lib/api';
import { KycStatus } from '@/lib/types';
import { withRefreshToken } from '@/lib/utils';
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
  status?: 'pending' | 'under_review' | 'completed' | 'rejected';
}

export function useCardSteps(initialKycStatus?: KycStatus) {
  const [activeStepId, setActiveStepId] = useState<number | null>(null);
  const [cardActivated, setCardActivated] = useState(false);
  const [activatingCard, setActivatingCard] = useState(false);

  const router = useRouter();
  const { kycLinkId } = useKycStore();

  console.log('kycLinkId', kycLinkId);

  // Get KYC link status if KYC link ID exists
  const { data: kycLink } = useKycLinkFromBridge(kycLinkId || undefined);

  console.log('kycLink', kycLink);

  // Determine KYC status from multiple sources, preferring an initial override from redirectUri
  const kycStatus = useMemo(() => {
    // Optimistic status passed via redirectUri after finishing KYC
    if (initialKycStatus) {
      return initialKycStatus;
    }
    // If we have a KYC link, check its status
    if (kycLink) {
      return (kycLink?.kyc_status as KycStatus) || KycStatus.UNDER_REVIEW;
    }
    return KycStatus.NOT_STARTED;
  }, [initialKycStatus, kycLink]);

  console.log('kycStatus', kycStatus);

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
      }
    } catch (_e) {
      // If status check fails, we still allow starting KYC flow
    }

    const baseUrl = process.env.EXPO_PUBLIC_BASE_URL;
    const redirectUri = `${baseUrl}${path.CARD_ACTIVATE_MOBILE}?kycStatus=${KycStatus.UNDER_REVIEW}`;

    const params = new URLSearchParams({
      kycMode: KycMode.CARD,
      endorsement: Endorsements.CARDS,
      redirectUri,
    }).toString();

    router.push(`/user-kyc-info?${params}`);
  }, [router, kycLinkId]);

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

  const steps: Step[] = useMemo(
    () => [
      {
        id: 1,
        title: 'Complete KYC',
        description:
          kycStatus === KycStatus.REJECTED
            ? rejectionReasonsText ||
              'We couldn’t verify your identity. Please review the issues and try again.'
            : 'Identity verification required for us to issue your card',
        completed: kycStatus === KycStatus.APPROVED || cardActivated,
        status:
          kycStatus === KycStatus.UNDER_REVIEW
            ? 'under_review'
            : kycStatus === KycStatus.APPROVED
              ? 'completed'
              : kycStatus === KycStatus.REJECTED
                ? 'rejected'
                : 'pending',
        buttonText:
          kycStatus === KycStatus.UNDER_REVIEW
            ? 'Under Review'
            : kycStatus === KycStatus.REJECTED
              ? 'Retry KYC'
              : 'Complete KYC',
        onPress: kycStatus === KycStatus.UNDER_REVIEW ? undefined : handleProceedToKyc,
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
    ],
    [
      kycStatus,
      cardActivated,
      handleProceedToKyc,
      handleActivateCard,
      router,
      rejectionReasonsText,
    ],
  );

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
    if (currentStep?.status === 'under_review') {
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
