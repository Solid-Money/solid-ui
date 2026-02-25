import React, { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { Check } from 'lucide-react-native';

import { Text } from '@/components/ui/text';
import { DepositStep } from '@/lib/types';
import { DEPOSIT_STEPS, getDepositStepIndex } from '@/lib/utils/deposit-steps';

const STEP_LABELS: Record<string, string> = {
  detected: 'Transfer Detected',
  confirmed: 'Transfer Confirmed',
  depositing: 'Depositing to Vault',
  minting: 'Minting soUSD',
  complete: 'Complete',
};

interface DepositStepperProps {
  currentStep: DepositStep | undefined;
  isFailed?: boolean;
}

/**
 * A single step row: circle indicator + label.
 * Extracted for clarity; the pulse animation is driven by the parent via `isActive`.
 */
function CompletedCircle() {
  return (
    <View className="h-6 w-6 items-center justify-center rounded-full bg-[#34C759]">
      <Check size={14} color="white" strokeWidth={3} />
    </View>
  );
}

function PendingCircle() {
  return <View className="h-6 w-6 rounded-full border border-[#3A3A3C]" />;
}

function ActiveCircle({ isFailed }: { isFailed: boolean }) {
  const scale = useSharedValue(1);

  useEffect(() => {
    scale.value = withRepeat(
      withSequence(withTiming(1.15, { duration: 600 }), withTiming(1.0, { duration: 600 })),
      -1,
      false,
    );
  }, [scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View
      style={animatedStyle}
      className={`h-6 w-6 rounded-full ${isFailed ? 'bg-red-500' : 'bg-brand'}`}
    />
  );
}

/**
 * Connecting line between two steps.
 * Animates its background color based on whether the segment is completed.
 */
function ConnectingLine({ completed }: { completed: boolean }) {
  const opacity = useSharedValue(completed ? 1 : 0);

  useEffect(() => {
    opacity.value = withTiming(completed ? 1 : 0, { duration: 300 });
  }, [completed, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <View className="ml-[11px] h-5 w-0.5 bg-[#2C2C2E]">
      <Animated.View style={[{ flex: 1, backgroundColor: '#34C759' }, animatedStyle]} />
    </View>
  );
}

function DepositStepperInner({ currentStep, isFailed = false }: DepositStepperProps) {
  const currentStepIndex = getDepositStepIndex(currentStep);

  return (
    <View className="rounded-[20px] bg-[#1C1C1E] p-4">
      {DEPOSIT_STEPS.map((step, index) => {
        const isCompleted = currentStepIndex >= 0 && index < currentStepIndex;
        const isActive = currentStepIndex >= 0 && index === currentStepIndex;
        const isLast = index === DEPOSIT_STEPS.length - 1;

        // Determine the line completion state: the line *after* step i is completed
        // if the step at i+1 is completed (i.e., i+1 < currentStepIndex).
        const lineCompleted = currentStepIndex >= 0 && index + 1 <= currentStepIndex;

        return (
          <View key={step.key}>
            {/* Step row */}
            <View className="flex-row items-center gap-3">
              {/* Circle indicator */}
              {isCompleted ? (
                <CompletedCircle />
              ) : isActive ? (
                <ActiveCircle isFailed={isFailed} />
              ) : (
                <PendingCircle />
              )}

              {/* Label */}
              <Text
                className={`text-sm font-medium ${
                  isActive && isFailed
                    ? 'text-red-500'
                    : isCompleted || isActive
                      ? 'text-white'
                      : 'text-[#8E8E93]'
                }`}
              >
                {STEP_LABELS[step.key] ?? step.label}
              </Text>
            </View>

            {/* Connecting line (skip after last step) */}
            {!isLast && <ConnectingLine completed={lineCompleted} />}
          </View>
        );
      })}
    </View>
  );
}

const DepositStepper = React.memo(DepositStepperInner);
DepositStepper.displayName = 'DepositStepper';

export default DepositStepper;
