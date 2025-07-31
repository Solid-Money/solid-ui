import { Image } from 'expo-image';
import { useLocalSearchParams } from 'expo-router';
import React from 'react';
import { Pressable, View } from 'react-native';

import { AnimatedStepContent } from '@/components/Card/AnimatedStepContent';
import { StepIndicator } from '@/components/Card/StepIndicator';
import { Text } from '@/components/ui/text';
import { useCardSteps } from '@/hooks/useCardSteps';
import { KycStatus } from '@/lib/types';

export default function ActivateMobile() {
  const { kycLink, kycStatus } = useLocalSearchParams<{
    kycLink?: string;
    kycStatus?: KycStatus;
  }>();

  console.log('kycStatus', kycStatus);
  console.log('kycLink', kycLink);

  const { steps, activeStepId, isStepButtonEnabled, toggleStep } = useCardSteps();

  return (
    <View className="flex-1 bg-background">
      {/* Card */}
      <Image
        source={require('@/assets/images/card_details.png')}
        alt="Solid Card"
        style={{ width: '100%', height: 200 }}
        contentFit="cover"
      />

      {/* Card issuance status */}
      <View className="flex-1 px-6 mt-8">
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
                />
              </View>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}
