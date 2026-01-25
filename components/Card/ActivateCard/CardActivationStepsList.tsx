import { View } from 'react-native';

import { CardActivationStep } from '@/components/Card/CardActivationStep';
import { Step } from '@/hooks/useCardSteps';

interface CardActivationStepsListProps {
  steps: Step[];
  activeStepId: number | null;
  isCardPending: boolean;
  isStepButtonEnabled: (index: number) => boolean;
  canToggleStep: (stepId: number) => boolean;
  activatingCard: boolean;
  onToggle: (stepId: number) => void;
}

export function CardActivationStepsList({
  steps,
  activeStepId,
  isCardPending,
  isStepButtonEnabled,
  canToggleStep,
  activatingCard,
  onToggle,
}: CardActivationStepsListProps) {
  return (
    <View className="rounded-xl bg-[#1C1C1C] p-6">
      {steps.map((step, index) => (
        <CardActivationStep
          key={step.id}
          step={
            isCardPending && step.id === 2 ? { ...step, buttonText: 'Card creation pending' } : step
          }
          index={index}
          totalSteps={steps.length}
          isActive={activeStepId === step.id}
          canToggle={canToggleStep(step.id)}
          isButtonEnabled={!isCardPending && isStepButtonEnabled(index)}
          activatingCard={activatingCard}
          onToggle={onToggle}
        />
      ))}
    </View>
  );
}
