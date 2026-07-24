import React from 'react';
import { View } from 'react-native';
import { Image } from 'expo-image';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { useLandingPageApy } from '@/hooks/useLandingPageApy';
import { getAsset } from '@/lib/assets';

interface LandingScreenProps {
  /** Advances the flow to the Welcome step (opens the auth sheet). */
  onGetStarted: () => void;
}

/**
 * Step 1 of the redesigned mobile onboarding — a full-bleed hero with the Solid
 * lockup, headline and a single "Get started" call-to-action. The hero image
 * and dark scrim are provided by the parent (OnboardingNew) so they persist
 * while the Welcome sheet animates in on top.
 *
 * Figma: node 20048-2441.
 */
export function LandingScreen({ onGetStarted }: LandingScreenProps) {
  const { apy } = useLandingPageApy();
  // Fall back to 8 while loading or when no APY is configured, so the copy
  // never renders "0%".
  const apyLabel = apy > 0 ? Number(apy.toFixed(1)) : 8;

  return (
    <View className="flex-1 justify-end px-5 pb-3">
      {/* Solid logo lockup */}
      <Image
        source={getAsset('images/solid-wordmark.png')}
        alt="Solid"
        style={{ width: 92, height: 27 }}
        contentFit="contain"
      />

      <Text className="mt-9 text-[40px] font-medium leading-[40px] -tracking-[2px] text-white">
        Your Money{'\n'}Never Sleeps
      </Text>

      <Text className="mt-4 text-base leading-[1.2] text-white/70">
        Earn up to {apyLabel}% return on your savings automatically, and spend globally with your
        Solid card, all in one account.
      </Text>

      <Button
        variant="secondary"
        className="mt-8 h-[54px] w-full rounded-full border-0 bg-white active:opacity-90"
        onPress={onGetStarted}
      >
        <Text className="text-lg font-semibold text-black">Get started</Text>
      </Button>
    </View>
  );
}
