import { View } from 'react-native';

import {
  ActivateCardHeader,
  ActivateCardImage,
  CardActivationStepsList,
  CardStatusBanner,
  LoadingState,
  UnderReviewState,
} from '@/components/Card/ActivateCard';
import { OnboardingFeeSheet } from '@/components/DepositOption/VirtualAccountDetails/OnboardingFeeSheet';
import PageLayout from '@/components/PageLayout';
import { Text } from '@/components/ui/text';
import { useActivateCard } from '@/hooks/useActivateCard';
import { useCardStatus } from '@/hooks/useCardStatus';
import { OnboardingFeeProduct } from '@/lib/types';

export default function ActivateMobile() {
  const {
    isCardStatusLoading,
    isCheckingCountry,
    isCardPending,
    isCardBlocked,
    isUnderReview,
    activationBlockedReason,
    activationFailure,
    retryActivation,
    steps,
    activeStepId,
    isStepButtonEnabled,
    toggleStep,
    canToggleStep,
    activatingCard,
    isFeeSheetOpen,
    closeFeeSheet,
    handleGoBack,
  } = useActivateCard();
  const { refetch: refetchCardStatus } = useCardStatus();

  if (isCardStatusLoading || isCheckingCountry) {
    return (
      <LoadingState message={isCardStatusLoading ? 'Loading...' : 'Checking availability...'} />
    );
  }

  // Verification is in and the decision is still being made, so there is no step
  // to offer: this takes over the screen rather than sitting under a steps list
  // whose first row would invite the user to verify again.
  if (isUnderReview) {
    return <UnderReviewState />;
  }

  return (
    <PageLayout desktopOnly contentClassName="pb-10">
      <View className="mx-auto w-full max-w-lg px-4 pt-8">
        <ActivateCardHeader onBack={handleGoBack} />
        <ActivateCardImage />

        <View className="mb-4 mt-8">
          <Text className="mb-4 text-lg font-medium text-white/70">Card issuance status</Text>
          <CardStatusBanner
            isPending={isCardPending}
            isBlocked={isCardBlocked}
            blockedReason={activationBlockedReason}
            failure={activationFailure}
            onRetry={retryActivation}
          />
          <CardActivationStepsList
            steps={steps}
            activeStepId={activeStepId}
            isCardPending={isCardPending}
            isStepButtonEnabled={isStepButtonEnabled}
            canToggleStep={canToggleStep}
            activatingCard={activatingCard}
            onToggle={toggleStep}
          />
        </View>
      </View>

      {isFeeSheetOpen ? (
        <OnboardingFeeSheet
          product={OnboardingFeeProduct.RAIN_CARD}
          onDismiss={closeFeeSheet}
          onPaid={() => {
            closeFeeSheet();
            // The step list reads `onboardingFeePaid` off /cards/status, so the
            // paid step only ticks once that is re-read.
            void refetchCardStatus();
          }}
        />
      ) : null}
    </PageLayout>
  );
}
