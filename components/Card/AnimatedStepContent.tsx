import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import React, { useEffect } from 'react';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

interface Step {
  id: number;
  title: string;
  description?: string;
  completed: boolean;
  buttonText?: string;
  onPress?: () => void;
}

interface AnimatedStepContentProps {
  step: Step;
  isActive: boolean;
  isButtonEnabled: boolean;
  activatingCard?: boolean;
}

export function AnimatedStepContent({
  step,
  isActive,
  isButtonEnabled,
  activatingCard,
}: AnimatedStepContentProps) {
  const height = useSharedValue(0);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (isActive) {
      height.value = withTiming(1, { duration: 300 });
      opacity.value = withTiming(1, { duration: 300 });
    } else {
      height.value = withTiming(0, { duration: 300 });
      opacity.value = withTiming(0, { duration: 200 });
    }
  }, [isActive, height, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    height: height.value === 0 ? 0 : 'auto',
    opacity: opacity.value,
    transform: [{ scaleY: height.value }],
  }));

  return (
    <Animated.View style={animatedStyle}>
      {step.description && (
        <Text className="text-sm text-white/60 mb-4 leading-5">{step.description}</Text>
      )}

      {step.buttonText && !step.completed && (
        <Button
          className={`rounded-xl h-12 w-full mb-4 ${
            isButtonEnabled ? 'bg-[#94F27F]' : 'bg-gray-500 opacity-50'
          }`}
          onPress={isButtonEnabled ? step.onPress : undefined}
          disabled={!isButtonEnabled || activatingCard}
        >
          <Text
            className={`font-semibold text-base ${
              isButtonEnabled ? 'text-black' : 'text-gray-300'
            }`}
          >
            {activatingCard ? 'Activating...' : step.buttonText}
          </Text>
        </Button>
      )}
    </Animated.View>
  );
}
