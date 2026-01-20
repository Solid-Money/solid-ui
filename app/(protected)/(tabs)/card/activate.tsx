import React from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';

import { EndorsementStatus } from '@/components/BankTransfer/enums';
import { CardActivationStep } from '@/components/Card/CardActivationStep';
import PageLayout from '@/components/PageLayout';
import { Text } from '@/components/ui/text';
import { path } from '@/constants/path';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { useCardStatus } from '@/hooks/useCardStatus';
import { useCardSteps } from '@/hooks/useCardSteps';
import { useCountryCheck } from '@/hooks/useCountryCheck';
import { track } from '@/lib/analytics';
import { getAsset } from '@/lib/assets';
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

  const { data: cardStatusResponse } = useCardStatus();
  const cardStatus = cardStatusResponse?.status;
  const isCardPending = cardStatus === CardStatus.PENDING;
  const isCardBlocked = Boolean(cardStatusResponse?.activationBlocked);
  const activationBlockedReason =
    cardStatusResponse?.activationBlockedReason ||
    'There was an issue activating your card. Please contact support.';

  // Skip country check if user already has a card or just confirmed country
  const userHasCard = !!cardStatus;
  const skipCountryCheck = countryConfirmed === 'true' || userHasCard;

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

  // Only run country check if user didn't just confirm their country and doesn't have a card
  const { checkingCountry } = useCountryCheck({ skip: skipCountryCheck });
  const isCheckingCountry = !skipCountryCheck && checkingCountry;

  // Check if endorsement is under review (has pending items)
  const isUnderReview =
    cardsEndorsement?.status === EndorsementStatus.INCOMPLETE &&
    Array.isArray(cardsEndorsement?.requirements?.pending) &&
    cardsEndorsement.requirements.pending.length > 0;

  // Track card activate page view (on mount only)
  React.useEffect(() => {
    track(TRACKING_EVENTS.CARD_ACTIVATE_PAGE_VIEWED, {
      card_status: cardStatus,
      kyc_status: _kycStatus,
      is_card_pending: isCardPending,
      is_card_blocked: isCardBlocked,
      is_under_review: isUnderReview,
      country_confirmed: countryConfirmed === 'true',
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // If the user already has a card, redirect to card details
  // (except PENDING which shows special "card on its way" UI)
  React.useEffect(() => {
    if (
      cardStatus === CardStatus.ACTIVE ||
      cardStatus === CardStatus.FROZEN ||
      cardStatus === CardStatus.INACTIVE
    ) {
      router.replace(path.CARD_DETAILS);
    }
  }, [cardStatus, router]);

  // Show loading state while checking country (skip if user just confirmed country)
  if (isCheckingCountry) {
    return (
      <PageLayout desktopOnly contentClassName="pb-10">
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#cccccc" />
          <Text className="mt-4 text-white/70">Checking availability...</Text>
        </View>
      </PageLayout>
    );
  }

  // Temporary: Card issuance disabled
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
            source={getAsset('images/activate_card_steps.png')}
            alt="Solid Card"
            style={{ width: '100%', aspectRatio: 513 / 306 }}
            contentFit="contain"
          />
        </View>
        <View className="mb-10 mt-8">
          <View className="items-center rounded-2xl border border-white/5 bg-[#1C1C1C] p-12">
            <Text className="text-2xl font-bold text-white text-center">Card issuance is temporarily disabled</Text>
            <Text className="mt-4 text-center text-[#ACACAC]">
              Please check back later
            </Text>
          </View>
        </View>
      </View>
    </PageLayout>
  );

}
