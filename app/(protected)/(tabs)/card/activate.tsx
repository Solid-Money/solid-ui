import { View } from 'react-native';

import {
  ActivateCardHeader,
  ActivateCardImage,
  CardActivationStepsList,
  CardStatusBanner,
  LoadingState,
  UnderReviewState,
} from '@/components/Card/ActivateCard';
import PageLayout from '@/components/PageLayout';
import { Text } from '@/components/ui/text';
import { useActivateCard } from '@/hooks/useActivateCard';

export default function ActivateMobile() {
  const {
    isCheckingCountry,
    isCardPending,
    isCardBlocked,
    isUnderReview,
    activationBlockedReason,
    steps,
    activeStepId,
    isStepButtonEnabled,
    toggleStep,
    canToggleStep,
    activatingCard,
    handleGoBack,
  } = useActivateCard();

  if (isCheckingCountry) {
    return <LoadingState message="Checking availability..." />;
  }

  return (
    <PageLayout desktopOnly contentClassName="pb-10">
      <View className="mx-auto w-full max-w-lg px-4 pt-8">
        <ActivateCardHeader onBack={handleGoBack} />
        <ActivateCardImage />

        {isUnderReview ? (
          <UnderReviewState />
        ) : (
          <View className="mb-4 mt-8">
            <Text className="mb-4 text-lg font-medium text-white/70">Card issuance status</Text>
            <CardStatusBanner
              isPending={isCardPending}
              isBlocked={isCardBlocked}
              blockedReason={activationBlockedReason}
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
        )}
      </View>
    </PageLayout>
  );
}
