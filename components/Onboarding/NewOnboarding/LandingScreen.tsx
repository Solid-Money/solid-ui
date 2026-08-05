import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
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
  const insets = useSafeAreaInsets();

  return (
    <View style={StyleSheet.absoluteFill}>
      {/* Solid logo lockup */}
      <View accessible accessibilityLabel="Solid" style={styles.logoLockup}>
        <Image
          source={getAsset('images/onboarding-landing-mark.svg')}
          alt=""
          style={styles.logoMark}
          contentFit="fill"
        />
        <Image
          source={getAsset('images/onboarding-landing-solid.svg')}
          alt=""
          style={styles.logoWord}
          contentFit="fill"
        />
      </View>

      <Text className="font-normal text-white" style={styles.title}>
        The stablecoin money app
      </Text>

      <Text className="font-normal text-white/70" style={styles.description}>
        A dollar account for anyone, anywhere. Save, earn, and spend globally with your Solid card
      </Text>

      <Button
        variant="secondary"
        className="absolute left-[20px] right-[20px] h-[54px] rounded-full border-0 bg-white active:opacity-90"
        style={{ bottom: insets.bottom + 12 }}
        onPress={onGetStarted}
      >
        <Text className="text-[18px] font-semibold text-black">Get started</Text>
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  logoLockup: {
    position: 'absolute',
    top: 97,
    left: '50%',
    width: 92.046,
    height: 27.092,
    marginLeft: -46.023,
  },
  logoMark: {
    position: 'absolute',
    top: 3.02,
    left: 0,
    width: 21.098,
    height: 24.072,
  },
  logoWord: {
    position: 'absolute',
    top: 0,
    left: 28.53,
    width: 63.516,
    height: 24.903,
  },
  title: {
    position: 'absolute',
    top: 157,
    left: '50%',
    width: 303,
    marginLeft: -151.5,
    color: '#fff',
    fontFamily: 'MonaSans_400Regular',
    fontSize: 44,
    lineHeight: 44,
    letterSpacing: -2,
    textAlign: 'center',
  },
  description: {
    position: 'absolute',
    top: 268,
    left: '50%',
    width: 303,
    marginLeft: -151.5,
    color: 'rgba(255, 255, 255, 0.7)',
    fontFamily: 'MonaSans_400Regular',
    fontSize: 18,
    lineHeight: 21.6,
    textAlign: 'center',
  },
});
