import React, { useEffect } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { Image } from 'expo-image';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { getAsset } from '@/lib/assets';

interface WelcomeSheetProps {
  /** Whether the card is presented (slid up). */
  visible: boolean;
  /** Dismisses the card back to the landing step. */
  onClose: () => void;
  onCreateAccount: () => void;
  onLogin: () => void;
  isLoginPending: boolean;
  /** Optional help/recovery prompt shown after a failed login attempt. */
  recoveryLink?: React.ReactNode;
}

const SHEET_HEIGHT = 410;

/**
 * Step 2 of the redesigned mobile onboarding — the "Welcome" auth card that
 * slides up over the landing hero, offering Create an account / Log in. Tapping
 * the scrim or the drag handle dismisses it back to the landing step.
 *
 * Figma: node 20587-4163. The sheet is bottom-anchored, with only its top
 * corners rounded, and intentionally extends two pixels past the right edge so
 * the curved edge remains flush with the viewport.
 */
export function WelcomeSheet({
  visible,
  onClose,
  onCreateAccount,
  onLogin,
  isLoginPending,
  recoveryLink,
}: WelcomeSheetProps) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(visible ? 1 : 0, { duration: 260 });
  }, [visible, progress]);

  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: (1 - progress.value) * SHEET_HEIGHT }],
  }));

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents={visible ? 'auto' : 'none'}>
      {/* The shared hero already owns the Figma's 30% scrim. */}
      <Pressable style={styles.dismissArea} onPress={onClose} />

      <Animated.View style={[styles.card, cardStyle]}>
        {/* Drag handle */}
        <Pressable onPress={onClose} style={styles.handleTouchTarget}>
          <View style={styles.handle} />
        </Pressable>

        <Image
          source={getAsset('images/onboarding-welcome-logo.svg')}
          alt=""
          style={styles.logo}
          contentFit="fill"
        />

        <Text className="font-medium text-white" style={styles.title}>
          Welcome
        </Text>

        <Button
          variant="brand"
          className="absolute left-[19px] right-[19px] top-[195px] h-[50px] rounded-full active:opacity-90"
          onPress={onCreateAccount}
        >
          <Text className="text-base font-semibold text-black" style={styles.buttonLabel}>
            Create an account
          </Text>
        </Button>

        {/* OR divider */}
        <View style={[styles.divider, styles.dividerLeft]} />
        <Text className="text-white/50" style={styles.orLabel}>
          OR
        </Text>
        <View style={[styles.divider, styles.dividerRight]} />

        <Button
          variant="secondary"
          className="absolute left-[19px] right-[19px] top-[306px] h-[50px] rounded-full border-0 bg-white active:opacity-90"
          onPress={onLogin}
          disabled={isLoginPending}
        >
          {isLoginPending ? (
            <View className="flex-row items-center">
              <ActivityIndicator size="small" color="#000" />
              <Text className="ml-2 text-base font-semibold text-black">Authenticating...</Text>
            </View>
          ) : (
            <View style={styles.loginLabelGroup}>
              <Image
                source={getAsset('images/onboarding-welcome-key.svg')}
                alt=""
                style={styles.keyIcon}
                contentFit="fill"
              />
              <Text className="text-base font-semibold text-black" style={styles.buttonLabel}>
                Log in
              </Text>
            </View>
          )}
        </Button>

        {/* Account recovery prompt — only after a failed login */}
        {recoveryLink ? <View style={styles.recoveryLink}>{recoveryLink}</View> : null}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  dismissArea: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: SHEET_HEIGHT,
    left: 0,
  },
  card: {
    position: 'absolute',
    right: -2,
    bottom: 0,
    left: 0,
    height: SHEET_HEIGHT,
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
    backgroundColor: '#1c1c1c',
    overflow: 'hidden',
  },
  handleTouchTarget: {
    position: 'absolute',
    top: 0,
    right: 0,
    left: 0,
    height: 40,
    alignItems: 'center',
    paddingTop: 17,
  },
  handle: {
    width: 73,
    height: 5,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  logo: {
    position: 'absolute',
    top: 63,
    left: '50%',
    width: 28,
    height: 31.9474,
    marginLeft: -14,
  },
  title: {
    position: 'absolute',
    top: 111,
    right: 0,
    left: 0,
    color: '#fff',
    fontFamily: 'MonaSans_500Medium',
    fontSize: 30,
    lineHeight: 36,
    letterSpacing: -1,
    textAlign: 'center',
  },
  buttonLabel: {
    color: '#000',
    fontFamily: 'MonaSans_600SemiBold',
    fontSize: 16,
    lineHeight: 20,
    letterSpacing: -0.15,
  },
  divider: {
    position: 'absolute',
    top: 272,
    width: 142,
    height: 2,
    backgroundColor: '#323232',
  },
  dividerLeft: {
    left: 19,
  },
  dividerRight: {
    right: 19,
  },
  orLabel: {
    position: 'absolute',
    top: 267,
    right: 0,
    left: 0,
    fontFamily: 'MonaSans_400Regular',
    fontSize: 13.5,
    lineHeight: 17,
    textAlign: 'center',
  },
  loginLabelGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11.5,
  },
  keyIcon: {
    width: 23.491,
    height: 11.8467,
  },
  recoveryLink: {
    position: 'absolute',
    top: 366,
    right: 19,
    left: 19,
  },
});
