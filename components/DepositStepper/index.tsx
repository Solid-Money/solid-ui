import React, { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { Check, X } from 'lucide-react-native';

import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';
import { DepositProgressRow, DepositProgressState } from '@/lib/utils/deposit-steps';

const BRAND = '#94F27F';
const CIRCLE_SIZE = 22;

interface DepositStepperProps {
  rows: DepositProgressRow[];
  className?: string;
}

function CompletedCircle() {
  return (
    <View
      className="items-center justify-center rounded-full bg-brand"
      style={{ width: CIRCLE_SIZE, height: CIRCLE_SIZE }}
    >
      <Check size={13} color="#404041" strokeWidth={2.5} />
    </View>
  );
}

function PendingCircle() {
  return (
    <View
      className="rounded-full border-[1.5px] border-white/50"
      style={{ width: CIRCLE_SIZE, height: CIRCLE_SIZE }}
    />
  );
}

function FailedCircle() {
  return (
    <View
      className="items-center justify-center rounded-full bg-red-500"
      style={{ width: CIRCLE_SIZE, height: CIRCLE_SIZE }}
    >
      <X size={13} color="#FFFFFF" strokeWidth={2.5} />
    </View>
  );
}

/** Ring with a pulsing dot, marking the step currently in progress. */
function ActiveCircle() {
  const scale = useSharedValue(1);

  useEffect(() => {
    scale.value = withRepeat(
      withSequence(withTiming(1.25, { duration: 700 }), withTiming(1, { duration: 700 })),
      -1,
      false,
    );
  }, [scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <View
      className="items-center justify-center rounded-full border-[1.5px] border-brand"
      style={{ width: CIRCLE_SIZE, height: CIRCLE_SIZE }}
    >
      <Animated.View
        style={[{ width: 8, height: 8, borderRadius: 4, backgroundColor: BRAND }, animatedStyle]}
      />
    </View>
  );
}

function StepCircle({ state }: { state: DepositProgressState }) {
  if (state === 'complete') return <CompletedCircle />;
  if (state === 'failed') return <FailedCircle />;
  if (state === 'active') return <ActiveCircle />;
  return <PendingCircle />;
}

/** Connecting line between two steps — brand green once the segment is done. */
function ConnectingLine({ completed }: { completed: boolean }) {
  const progress = useSharedValue(completed ? 1 : 0);

  useEffect(() => {
    progress.value = withTiming(completed ? 1 : 0, { duration: 300 });
  }, [completed, progress]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
  }));

  return (
    <View
      className="my-1 rounded-full bg-white/50"
      style={{ width: 1.5, height: 12, marginLeft: (CIRCLE_SIZE - 1.5) / 2 }}
    >
      <Animated.View style={[{ flex: 1, backgroundColor: BRAND }, animatedStyle]} />
    </View>
  );
}

function DepositStepperInner({ rows, className }: DepositStepperProps) {
  if (!rows.length) return null;

  return (
    <View className={cn('rounded-twice bg-card px-5 py-4', className)}>
      {rows.map((row, index) => {
        const isLast = index === rows.length - 1;
        const nextRow = rows[index + 1];

        return (
          <View key={row.key}>
            <View className="flex-row items-center gap-3">
              <StepCircle state={row.state} />
              <Text
                className={cn(
                  'flex-1 text-base font-medium',
                  row.state === 'failed'
                    ? 'text-red-400'
                    : row.state === 'pending'
                      ? 'text-white/50'
                      : 'text-white',
                )}
              >
                {row.label}
              </Text>
            </View>

            {!isLast && <ConnectingLine completed={nextRow?.state !== 'pending'} />}
          </View>
        );
      })}
    </View>
  );
}

const DepositStepper = React.memo(DepositStepperInner);
DepositStepper.displayName = 'DepositStepper';

export default DepositStepper;
