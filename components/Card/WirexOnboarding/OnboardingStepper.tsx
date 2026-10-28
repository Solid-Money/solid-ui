import { View } from 'react-native';
import { Check } from 'lucide-react-native';

import { Text } from '@/components/ui/text';

export type OnboardingStepNumber = 1 | 2 | 3;

const STEPS: { number: OnboardingStepNumber; label: string }[] = [
  { number: 1, label: 'Country' },
  { number: 2, label: 'Verify' },
  { number: 3, label: 'Activate' },
];

const BRAND = '#94F27F';
const IDLE_LINE = '#2F2F2F';
const CURRENT_CIRCLE = {
  backgroundColor: 'rgba(148,242,127,0.14)',
  borderColor: BRAND,
  borderWidth: 1.5,
} as const;
const NEXT_CIRCLE = { backgroundColor: '#262626' } as const;

/** The connector between `step` and the next one is lit once the next step is reached. */
const connectorColor = (step: number, current: OnboardingStepNumber) =>
  current > step ? BRAND : IDLE_LINE;

/**
 * The 3-step indicator over the Wirex card onboarding (Figma "Stepper"): Country, Verify,
 * Activate. A step behind the user is a green check, the current one a green ring around its
 * number, and the next one greyed out.
 *
 * Each column draws half of the two lines it sits between, so the line meets itself at the
 * column edge and the circles stay centred on any width.
 */
export function OnboardingStepper({ current }: { current: OnboardingStepNumber }) {
  return (
    <View
      className="flex-row"
      accessibilityRole="progressbar"
      accessibilityLabel={`Step ${current} of ${STEPS.length}: ${STEPS[current - 1].label}`}
    >
      {STEPS.map(({ number, label }, index) => {
        const isDone = number < current;
        const isCurrent = number === current;

        return (
          <View key={number} className="flex-1 items-center">
            <View className="h-[22px] w-full flex-row items-center">
              <View
                className="mr-2 h-[2px] flex-1 rounded-[1px]"
                style={{
                  backgroundColor:
                    index === 0 ? 'transparent' : connectorColor(number - 1, current),
                }}
              />
              {isDone ? (
                <View className="h-[22px] w-[22px] items-center justify-center rounded-full bg-[#94F27F]">
                  <Check size={13} color="#111111" strokeWidth={3} />
                </View>
              ) : (
                <View
                  className="h-[22px] w-[22px] items-center justify-center rounded-full"
                  style={isCurrent ? CURRENT_CIRCLE : NEXT_CIRCLE}
                >
                  <Text
                    className={`text-[12px] font-semibold ${
                      isCurrent ? 'text-[#94F27F]' : 'text-[#7A7A7A]'
                    }`}
                  >
                    {number}
                  </Text>
                </View>
              )}
              <View
                className="ml-2 h-[2px] flex-1 rounded-[1px]"
                style={{
                  backgroundColor:
                    index === STEPS.length - 1 ? 'transparent' : connectorColor(number, current),
                }}
              />
            </View>
            <Text
              className={`mt-[5px] text-[12px] ${
                isCurrent ? 'font-medium text-white' : isDone ? 'text-[#ACACAC]' : 'text-[#6F6F6F]'
              }`}
            >
              {label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

export default OnboardingStepper;
