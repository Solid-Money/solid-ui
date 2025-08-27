import { Endorsements } from '@/components/BankTransfer/enums';
import { KycMode } from '@/components/UserKyc';
import { path } from '@/constants/path';
import { createCard } from '@/lib/api';
import { KycStatus } from '@/lib/types';
import { withRefreshToken } from '@/lib/utils';
import { useKycStore } from '@/store/useKycStore';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useKycLinkFromBridge } from './useCustomer';
import Toast from 'react-native-toast-message';

interface Step {
  id: number;
  title: string;
  description?: string;
  completed: boolean;
  buttonText?: string;
  onPress?: () => void;
  status?: 'pending' | 'under_review' | 'completed';
}

export function useCardSteps() {
  const [activeStepId, setActiveStepId] = useState<number | null>(null);
  const [cardActivated, setCardActivated] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const router = useRouter();
  const { kycLinkId } = useKycStore();

  console.log('kycLinkId', kycLinkId);

  // Get KYC link status if KYC link ID exists
  const { data: kycLink } = useKycLinkFromBridge(kycLinkId || undefined);

  console.log('kycLink', kycLink);

  // Determine KYC status from multiple sources
  const kycStatus = useMemo(() => {
    // If we have a KYC link, check its status first
    if (kycLink) {
      // KYC link exists, but we need to determine status based on the link data
      // This might need adjustment based on what the API returns
      return kycLink?.kyc_status || KycStatus.UNDER_REVIEW;
    }

    return KycStatus.NOT_STARTED;
  }, [kycLink]);

  console.log('kycStatus', kycStatus);

  const handleProceedToKyc = useCallback(async () => {
    const baseUrl = process.env.EXPO_PUBLIC_BASE_URL;
    const redirectUri = `${baseUrl}${path.CARD_ACTIVATE_MOBILE}?kycStatus=${KycStatus.UNDER_REVIEW}`;

    const params = new URLSearchParams({
      kycMode: KycMode.CARD,
      endorsement: Endorsements.CARDS,
      redirectUri,
    }).toString();

    router.push(`/user-kyc-info?${params}`);
  }, [router]);

  const handleActivateCard = useCallback(async () => {
    try {
      setIsLoading(true);
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
      setIsLoading(false);
    }
  }, [router]);

  const steps: Step[] = useMemo(
    () => [
      {
        id: 1,
        title: 'Complete KYC',
        description: 'Identity verification required for us to issue your card',
        completed: kycStatus === KycStatus.APPROVED || cardActivated,
        status:
          kycStatus === KycStatus.UNDER_REVIEW
            ? 'under_review'
            : kycStatus === KycStatus.APPROVED
              ? 'completed'
              : 'pending',
        buttonText: kycStatus === KycStatus.UNDER_REVIEW ? 'Under Review' : 'Complete KYC',
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
    [kycStatus, cardActivated, handleProceedToKyc, handleActivateCard, router],
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
    // return true;
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
    isLoading,
  };
}
