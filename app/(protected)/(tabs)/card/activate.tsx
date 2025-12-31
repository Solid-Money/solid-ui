import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import React from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';

import { EndorsementStatus } from '@/components/BankTransfer/enums';
import { CardActivationStep } from '@/components/Card/CardActivationStep';
import PageLayout from '@/components/PageLayout';
import { Text } from '@/components/ui/text';
import { path } from '@/constants/path';
import { useCardStatus } from '@/hooks/useCardStatus';
import { useCardSteps } from '@/hooks/useCardSteps';
import { useCountryCheck } from '@/hooks/useCountryCheck';
import { CardStatus, KycStatus } from '@/lib/types';

export default function ActivateMobile() {
  const {
    kycLink: _kycLink,
    kycStatus: _kycStatus,
    countryConfirmed,
  } = useLocalSearchParams<{
    kycLink?: string;
    kycStatus?: KycStatus;
    countryConfirmed?: string;
  }>();

  // Skip country check if user just confirmed country on country_selection page
  const skipCountryCheck = countryConfirmed === 'true';

  const { data: cardStatusResponse } = useCardStatus();
  const cardStatus = cardStatusResponse?.status;
  const isCardPending = cardStatus === CardStatus.PENDING;
  const isCardBlocked = Boolean(cardStatusResponse?.activationBlocked);
  const activationBlockedReason =
    cardStatusResponse?.activationBlockedReason ||
    'There was an issue activating your card. Please contact support.';

  const {
    steps,
    activeStepId,
    isStepButtonEnabled,
    toggleStep,
    canToggleStep,
    activatingCard,
    cardsEndorsement,
  } = useCardSteps(_kycStatus as KycStatus | undefined, cardStatusResponse);

  const router = useRouter();

  // Only run country check if user didn't just confirm their country
  const { checkingCountry } = useCountryCheck();
  const isCheckingCountry = !skipCountryCheck && checkingCountry;

  // Check if endorsement is under review (has pending items)
  const isUnderReview =
    cardsEndorsement?.status === EndorsementStatus.INCOMPLETE &&
    Array.isArray(cardsEndorsement?.requirements?.pending) &&
    cardsEndorsement.requirements.pending.length > 0;

  // If the card is already active, skip the activation flow
  React.useEffect(() => {
    if (cardStatus === CardStatus.ACTIVE || cardStatus === CardStatus.FROZEN) {
      router.replace(path.CARD_DETAILS);
    }
  }, [cardStatus, router]);

  // Show loading state while checking country (skip if user just confirmed country)
  if (isCheckingCountry) {
    return (
      <PageLayout desktopOnly contentClassName="pb-10">
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#94F27F" />
          <Text className="mt-4 text-white/70">Checking availability...</Text>
        </View>
      </PageLayout>
    );
  }

  return (
    <PageLayout desktopOnly contentClassName="pb-10">
      <View className="mx-auto w-full max-w-lg px-4 pt-8">
        <View className="flex-row items-center justify-between">
          <Pressable
            onPress={() => (router.canGoBack() ? router.back() : router.push(path.CARD))}
            className="web:hover:opacity-70"
          >
            <ArrowLeft color="white" />
          </Pressable>
          <Text className="text-center text-xl font-semibold text-white md:text-2xl">
            Solid card
          </Text>
          <View className="w-10" />
        </View>
        <View className="mt-8 items-center justify-center">
          <Image
            source={require('@/assets/images/activate_card_steps.png')}
            alt="Solid Card"
            style={{ width: '100%', aspectRatio: 513 / 306 }}
            contentFit="contain"
          />
        </View>

        {/* Under review state (endorsement has pending items) */}
        {isUnderReview ? (
          <View className="mb-10 mt-8">
            <View className="items-center rounded-2xl border border-white/5 bg-[#1C1C1C] p-12">
              <View className="mb-4">
                <Image
                  source={require('@/assets/images/kyc_under_review.png')}
                  alt="KYC under review"
                  style={{ width: 144, height: 144 }}
                  contentFit="contain"
                />
              </View>

              <Text className="mt-6 text-2xl font-bold text-white">Your card is on its way!</Text>
              <Text className="my-3 text-center text-[#ACACAC]">
                Thanks for your submission. Your
                <br />
                identity is now being verified.
              </Text>
            </View>
          </View>
        ) : (
          /* Card issuance status */
          <View className="mb-4 mt-8">
            <Text className="mb-4 text-lg font-medium text-white/70">Card issuance status</Text>

            {isCardPending && (
              <View className="mb-4 rounded-xl border border-yellow-500/30 bg-[#1C1C1C] p-4">
                <Text className="text-base font-semibold text-white">Your card is on its way</Text>
                <Text className="mt-2 text-sm text-white/70">
                  We&rsquo;re finishing up your card. This may take some time.
                </Text>
              </View>
            )}
            {isCardBlocked && (
              <View className="mb-4 rounded-xl border border-red-500/30 bg-[#1C1C1C] p-4">
                <Text className="text-base font-semibold text-white">Card activation rejected</Text>
                <Text className="mt-2 text-sm text-white/70">{activationBlockedReason}</Text>
              </View>
            )}

            <View className="rounded-xl bg-[#1C1C1C] p-6">
              {steps.map((step, index) => (
                <CardActivationStep
                  key={step.id}
                  step={
                    isCardPending && step.id === 2
                      ? { ...step, buttonText: 'Card creation pending' }
                      : step
                  }
                  index={index}
                  totalSteps={steps.length}
                  isActive={activeStepId === step.id}
                  canToggle={canToggleStep(step.id)}
                  isButtonEnabled={!isCardPending && isStepButtonEnabled(index)}
                  activatingCard={activatingCard}
                  onToggle={toggleStep}
                />
              ))}
            </View>
          </View>
        )}
      </View>
    </PageLayout>
  );
}
