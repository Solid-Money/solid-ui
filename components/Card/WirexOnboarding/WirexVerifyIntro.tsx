import { useEffect, useRef } from 'react';
import { ActivityIndicator, View } from 'react-native';

import FaceScan from '@/assets/images/face-scan';
import { WirexOnboardingLayout } from '@/components/Card/WirexOnboarding/WirexOnboardingLayout';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { track } from '@/lib/analytics';

const REQUIREMENTS = [
  {
    title: 'Your ID',
    description: 'ID card, passport, driver’s license or residence permit',
  },
  {
    title: 'Proof of address',
    description: 'A recent bank statement or utility bill with your name and address',
  },
  { title: 'A quick selfie', description: 'To check it’s really you' },
];

interface WirexVerifyIntroProps {
  onStart: () => void;
  onBack?: () => void;
  /** The check was opened before: the button resumes it rather than starting over. */
  resuming?: boolean;
  isStarting?: boolean;
}

/**
 * "What you'll need" (Figma 2 · What you'll need) — the step before Sumsub opens.
 *
 * It names all three things the Wirex level asks for, proof of address included: 191 of the 288
 * applicants asked to resend something since August were asked for exactly that, because nothing
 * told them up front it was coming. Sumsub keeps a check that was started, so the screen can say
 * the progress is saved.
 */
export function WirexVerifyIntro({ onStart, onBack, resuming, isStarting }: WirexVerifyIntroProps) {
  // Once per screen visit; `resuming` only labels it.
  const hasTrackedViewRef = useRef(false);
  useEffect(() => {
    if (hasTrackedViewRef.current) return;
    hasTrackedViewRef.current = true;
    track(TRACKING_EVENTS.CARD_ONBOARDING_STEP_VIEWED, { step: 'verify', resuming });
  }, [resuming]);

  const handleStart = () => {
    track(TRACKING_EVENTS.CARD_ONBOARDING_CTA_PRESSED, { step: 'verify', resuming });
    onStart();
  };

  return (
    <WirexOnboardingLayout
      step={2}
      onBack={onBack}
      footer={
        <View className="items-center">
          <Button variant="brand" className="w-full" onPress={handleStart} disabled={isStarting}>
            {isStarting ? (
              <ActivityIndicator color="#000000" />
            ) : (
              <Text>{resuming ? 'Continue verification' : 'Start verification'}</Text>
            )}
          </Button>
          <Text className="mt-3 text-center text-xs text-[#ACACAC]">
            Identity check by Sumsub, our verification partner
          </Text>
        </View>
      }
    >
      <View className="items-center gap-6">
        <View className="h-20 w-20 items-center justify-center rounded-full bg-[#1C1C1C]">
          <FaceScan width={44} height={44} />
        </View>

        <View className="items-center gap-1.5">
          <Text className="text-center text-2xl font-semibold text-white">
            Verify your identity
          </Text>
          <Text className="text-center text-sm text-[#ACACAC]">It takes a few minutes.</Text>
        </View>

        <View className="w-full gap-[18px] rounded-[20px] bg-[#1C1C1C] px-5 pb-[22px] pt-5">
          <Text className="text-sm font-medium text-[#ACACAC]">What you’ll need</Text>
          {REQUIREMENTS.map(({ title, description }, index) => (
            <View key={title} className="flex-row items-start gap-3.5">
              <View className="h-8 w-8 items-center justify-center rounded-full bg-[#2F2F2F]">
                <Text className="text-sm font-semibold text-white">{index + 1}</Text>
              </View>
              <View className="flex-1 gap-0.5">
                <Text className="text-base font-medium text-white">{title}</Text>
                <Text className="text-sm text-[#ACACAC]">{description}</Text>
              </View>
            </View>
          ))}
          <Text className="text-[13px] text-[#ACACAC]">
            You can stop anytime. We save your progress.
          </Text>
        </View>
      </View>
    </WirexOnboardingLayout>
  );
}

export default WirexVerifyIntro;
