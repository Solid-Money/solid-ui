import React from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { getAsset } from '@/lib/assets';

import { getLandingLayout, LOGO_LOCKUP_HEIGHT, MAX_FONT_SCALE } from './landingLayout';

interface LandingScreenProps {
  /** Advances the flow to the Welcome step (opens the auth sheet). */
  onGetStarted: () => void;
  /** Starts the existing-user login flow directly from the landing screen. */
  onLogin: () => void;
  isLoginPending: boolean;
}

/**
 * Step 1 of the redesigned mobile onboarding — a full-bleed hero with the Solid
 * lockup, headline, "Get started" call-to-action and existing-user login link.
 * The hero image and dark scrim are provided by the parent (OnboardingNew) so
 * they persist while the Welcome sheet animates in on top.
 *
 * The hero text is laid out in flow rather than pinned to the Figma frame's
 * absolute offsets, so a headline that wraps onto an extra line pushes the
 * description down instead of overlapping it. See `landingLayout` for the
 * metrics and the reasoning.
 *
 * Figma: node 20048-2441.
 */
export function LandingScreen({ onGetStarted, onLogin, isLoginPending }: LandingScreenProps) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const layout = getLandingLayout({
    width,
    height,
    topInset: insets.top,
    bottomInset: insets.bottom,
  });
  const bottomInset = layout.bottomInset;

  return (
    <View style={StyleSheet.absoluteFill}>
      <View style={[styles.heroContent, { paddingTop: layout.paddingTop }]}>
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

        <Text
          className="font-normal text-white"
          maxFontSizeMultiplier={MAX_FONT_SCALE}
          style={[
            styles.title,
            {
              width: layout.textWidth,
              marginTop: layout.titleMarginTop,
              fontSize: layout.titleFontSize,
              lineHeight: layout.titleLineHeight,
            },
          ]}
        >
          The stablecoin money app
        </Text>

        <Text
          className="font-normal text-white/70"
          maxFontSizeMultiplier={MAX_FONT_SCALE}
          style={[
            styles.description,
            {
              width: layout.textWidth,
              marginTop: layout.descriptionMarginTop,
              fontSize: layout.descriptionFontSize,
              lineHeight: layout.descriptionLineHeight,
            },
          ]}
        >
          A dollar account for anyone, anywhere. Save, earn, and spend globally with your Solid card
        </Text>
      </View>

      <Button
        variant="secondary"
        className="absolute left-[20px] right-[20px] h-[54px] rounded-full border-0 bg-white active:opacity-90"
        style={{ bottom: bottomInset + 48 }}
        onPress={onGetStarted}
      >
        <Text
          className="text-[18px] font-semibold text-black"
          maxFontSizeMultiplier={MAX_FONT_SCALE}
        >
          Get started
        </Text>
      </Button>

      <Pressable
        accessibilityRole="link"
        accessibilityLabel="Log in"
        className="absolute left-[20px] right-[20px] web:hover:opacity-70"
        style={{ bottom: bottomInset + 10 }}
        onPress={onLogin}
        disabled={isLoginPending}
        hitSlop={12}
      >
        <Text
          className="text-center font-normal text-white"
          maxFontSizeMultiplier={MAX_FONT_SCALE}
          style={styles.loginLink}
        >
          Already have an account? Log in
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  // Top-anchored flow column. Sized to its content, so it never covers the
  // bottom-anchored CTA or swallows its touches.
  heroContent: {
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  logoLockup: {
    width: 92.046,
    height: LOGO_LOCKUP_HEIGHT,
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
  // fontSize, lineHeight, width and the gap above are supplied per-device by
  // `getLandingLayout`.
  title: {
    color: '#fff',
    fontFamily: 'MonaSans_400Regular',
    letterSpacing: -2,
    textAlign: 'center',
  },
  description: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontFamily: 'MonaSans_400Regular',
    textAlign: 'center',
  },
  loginLink: {
    fontFamily: 'MonaSans_400Regular',
    fontSize: 16,
    lineHeight: 19.2,
  },
});
