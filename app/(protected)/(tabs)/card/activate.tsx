import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import React from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';

import { CardActivationStep } from '@/components/Card/CardActivationStep';
import PageLayout from '@/components/PageLayout';
import { Text } from '@/components/ui/text';
import { path } from '@/constants/path';
import { useCardSteps } from '@/hooks/useCardSteps';
import { useCardStatus } from '@/hooks/useCardStatus';
import { useCountryCheck } from '@/hooks/useCountryCheck';
import { CardStatus, KycStatus } from '@/lib/types';

export default function ActivateMobile() {
  const { kycLink: _kycLink, kycStatus: _kycStatus } = useLocalSearchParams<{
    kycLink?: string;
    kycStatus?: KycStatus;
  }>();

  const { steps, activeStepId, isStepButtonEnabled, toggleStep, canToggleStep, activatingCard } =
    useCardSteps(_kycStatus as KycStatus | undefined);
  const { data: cardStatus } = useCardStatus();
  const isCardPending = cardStatus?.status === CardStatus.PENDING;

  const router = useRouter();
  const { checkingCountry } = useCountryCheck();

  // Show loading state while checking country
  if (checkingCountry) {
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
      <View className="w-full max-w-lg mx-auto pt-8 px-4">
        <View className="flex-row items-center justify-between">
          <Pressable
            onPress={() => (router.canGoBack() ? router.back() : router.push(path.CARD))}
            className="web:hover:opacity-70"
          >
            <ArrowLeft color="white" />
          </Pressable>
          <Text className="text-white text-xl md:text-2xl font-semibold text-center">
            Solid card
          </Text>
          <View className="w-10" />
        </View>
        <View className="items-center justify-center mt-8">
          <Image
            source={require('@/assets/images/activate_card_steps.png')}
            alt="Solid Card"
            style={{ width: '100%', aspectRatio: 513 / 306 }}
            contentFit="contain"
          />
        </View>

        {/* Card issuance status */}
        <View className="mt-8 mb-4">
          <Text className="text-lg font-medium text-white/70 mb-4">Card issuance status</Text>

          {isCardPending && (
            <View className="bg-[#1C1C1C] rounded-xl p-4 border border-yellow-500/30 mb-4">
              <Text className="text-white font-semibold">Your card is on its way</Text>
              <Text className="text-white/70 mt-2 text-sm">
                We&rsquo;re finishing up your card. This can take a few minutes. We&rsquo;ll let you
                know as soon as it&rsquo;s ready to use.
              </Text>
            </View>
          )}

          <View className="bg-[#1C1C1C] rounded-xl p-6">
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
      </View>
    </PageLayout>
  );
}
