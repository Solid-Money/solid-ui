import React from 'react';
import { Pressable, View } from 'react-native';

import { AnimatedStepContent } from '@/components/Card/AnimatedStepContent';
import { StepIndicator } from '@/components/Card/StepIndicator';
import { Text } from '@/components/ui/text';

interface Step {
  id: number;
  title: string;
  description?: string;
  completed: boolean;
  buttonText?: string;
  onPress?: () => void;
  status?: 'pending' | 'completed';
  kycStatus?: string;
}

// Type that matches what AnimatedStepContent expects
type StepForContent = Pick<
  Step,
  'id' | 'title' | 'description' | 'completed' | 'buttonText' | 'onPress'
>;

interface CardActivationStepProps {
  step: Step;
  index: number;
  totalSteps: number;
  isActive: boolean;
  canToggle: boolean;
  isButtonEnabled: boolean;
  activatingCard?: boolean;
  onToggle: (stepId: number) => void;
}

export function CardActivationStep({
  step,
  index,
  totalSteps,
  isActive,
  canToggle,
  isButtonEnabled,
  activatingCard,
  onToggle,
}: CardActivationStepProps) {
  return (
    <View className={`flex-row ${index < totalSteps - 1 ? 'pb-4' : ''}`}>
      <View className="items-center self-stretch">
        <StepIndicator
          stepId={step.id}
          completed={step.completed}
          onPress={canToggle ? () => onToggle(step.id) : () => {}}
        />
        {index < totalSteps - 1 && <View className="w-0.5 flex-1 bg-[#4D4D4D]" />}
      </View>

      <View className="ml-4 mt-1 flex-1 flex-shrink">
        <Pressable onPress={canToggle ? () => onToggle(step.id) : undefined} disabled={!canToggle}>
          <Text
            className={`mb-1 text-lg font-semibold ${canToggle ? 'text-white' : 'text-white/50'}`}
          >
            {step.title}
          </Text>
        </Pressable>

        <AnimatedStepContent
          step={step as StepForContent}
          isActive={isActive}
          isButtonEnabled={isButtonEnabled}
          activatingCard={activatingCard}
        />
      </View>
    </View>
  );
}
