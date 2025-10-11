import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { AnimatedStepContent } from '@/components/Card/AnimatedStepContent';
import { StepIndicator } from '@/components/Card/StepIndicator';
import Navbar from '@/components/Navbar';
import { Text } from '@/components/ui/text';
import { path } from '@/constants/path';
import { useCardSteps } from '@/hooks/useCardSteps';
import { useDimension } from '@/hooks/useDimension';
import { KycStatus } from '@/lib/types';
import { ArrowLeft } from 'lucide-react-native';

export default function ActivateMobile() {
  const { kycLink: _kycLink, kycStatus: _kycStatus } = useLocalSearchParams<{
    kycLink?: string;
    kycStatus?: KycStatus;
  }>();

  const { steps, activeStepId, isStepButtonEnabled, toggleStep, activatingCard } = useCardSteps();

  const { isScreenMedium } = useDimension();
  const router = useRouter();

  return (
    <View className="flex-1 bg-background">
      {isScreenMedium && <Navbar />}

      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 40 }}>
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
              style={{ width: '100%', aspectRatio: 512 / 306 }}
              contentFit="contain"
            />
          </View>

          {/* Card issuance status */}
          <View className="mt-8 mb-4">
            <Text className="text-lg font-medium text-white/70 mb-4">Card issuance status</Text>

            <View className="bg-[#333331] rounded-xl p-6">
              {steps.map((step, index) => (
                <View
                  key={step.id}
                  className={`flex-row items-start space-x-4 ${index < steps.length - 1 ? 'mb-4' : ''}`}
                >
                  <StepIndicator
                    stepId={step.id}
                    completed={step.completed}
                    onPress={() => toggleStep(step.id)}
                  />

                  <View className="flex-1 ml-4 mt-1">
                    <Pressable onPress={() => toggleStep(step.id)}>
                      <Text className="text-lg font-semibold text-white mb-1">{step.title}</Text>
                    </Pressable>

                    <AnimatedStepContent
                      step={step}
                      isActive={activeStepId === step.id}
                      isButtonEnabled={isStepButtonEnabled(index)}
                      activatingCard={activatingCard}
                    />
                  </View>
                </View>
              ))}
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
