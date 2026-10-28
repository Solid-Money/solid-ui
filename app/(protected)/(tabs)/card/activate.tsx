import { View } from 'react-native';
import { useRouter } from 'expo-router';

import {
  ActivateCardHeader,
  ActivateCardImage,
  CardActivationStepsList,
  CardStatusBanner,
  LoadingState,
  UnderReviewState,
} from '@/components/Card/ActivateCard';
import { WirexActivating } from '@/components/Card/WirexOnboarding/WirexActivating';
import {
  WirexActivationFailed,
  WirexChecking,
  WirexDeclined,
  WirexMoreDocuments,
  WirexNeedsSupport,
} from '@/components/Card/WirexOnboarding/WirexStatusScreens';
import { WirexVerifyIntro } from '@/components/Card/WirexOnboarding/WirexVerifyIntro';
import PageLayout from '@/components/PageLayout';
import { Text } from '@/components/ui/text';
import { path } from '@/constants/path';
import { BASE_SPEND_DEPLOYMENT } from '@/constants/spendModuleDeployments';
import { useActivateCard } from '@/hooks/useActivateCard';
import { useCardSpendDeployments } from '@/hooks/useEuroSpendEnablement';

export default function ActivateMobile() {
  const router = useRouter();
  const {
    isCardStatusLoading,
    isCheckingCountry,
    isResolvingWirexFlow,
    wirexStep,
    kycWarnings,
    hasOpenedCheck,
    startKyc,
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
    handleGoBack,
  } = useActivateCard();

  if (isCardStatusLoading || isCheckingCountry || isResolvingWirexFlow) {
    return (
      <LoadingState
        message={
          isCardStatusLoading || !isCheckingCountry ? 'Loading...' : 'Checking availability...'
        }
      />
    );
  }

  // Wirex applicants: one path, one screen per step, under the 3-step indicator. Rain and every
  // cardholder keep the issuance steps list below.
  if (wirexStep) {
    const goHome = () => router.replace(path.HOME);
    switch (wirexStep) {
      case 'verify':
        return (
          <WirexVerifyIntro onStart={startKyc} onBack={handleGoBack} resuming={hasOpenedCheck} />
        );
      case 'more-documents':
        return (
          <WirexMoreDocuments warnings={kycWarnings} onContinue={startKyc} onBack={handleGoBack} />
        );
      case 'checking':
        return <WirexChecking onGoHome={goHome} onBack={handleGoBack} />;
      case 'declined':
        return <WirexDeclined onContinue={goHome} onBack={handleGoBack} />;
      case 'support':
        return <WirexNeedsSupport onBack={handleGoBack} />;
      case 'activation-failed':
        return (
          <WirexActivationFailed
            failure={activationFailure}
            isBlocked={isCardBlocked}
            blockedReason={activationBlockedReason}
            onRetry={retryActivation}
            onBack={handleGoBack}
          />
        );
      case 'creating':
        return <WirexCreatingCard />;
      // `approved` is redirected to the Approved screen by the hook and never renders here.
    }
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
    </PageLayout>
  );
}

/**
 * The card is ordered and the issuer has not opened it yet: both approvals are behind the
 * applicant, so the Activating checklist shows them done and the card in progress. The screen
 * polls `/cards/status` and moves to the card the moment it opens.
 */
function WirexCreatingCard() {
  const { data } = useCardSpendDeployments();
  const euroOn =
    data?.deployments.find(deployment => deployment.chainId === BASE_SPEND_DEPLOYMENT.chainId)
      ?.enabled === true;

  return (
    <WirexActivating
      items={[
        { label: 'Card turned on', state: 'done' },
        ...(euroOn ? [{ label: 'Euro payments turned on', state: 'done' as const }] : []),
        { label: 'Creating your card…', state: 'active' },
      ]}
    />
  );
}
