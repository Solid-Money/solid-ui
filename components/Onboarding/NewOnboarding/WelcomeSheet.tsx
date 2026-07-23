import React, { useEffect } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';

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

// Fallback slide distance used before the card has measured its own height.
// Generous so the card always starts fully off-screen on first paint.
const DEFAULT_TRAVEL = 900;

/**
 * Step 2 of the redesigned mobile onboarding — the "Welcome" auth card that
 * slides up over the landing hero, offering Create account / Log in. Tapping
 * the scrim or the drag handle dismisses it back to the landing step.
 *
 * Per Figma (node 20587-4163) this is a floating rounded card (40px radius on
 * all corners) inset from every screen edge — not a bottom-anchored sheet. Its
 * hidden translation is driven off the measured height so it sits fully
 * off-screen until presented, never overlapping the landing step.
 */
export function WelcomeSheet({
  visible,
  onClose,
  onCreateAccount,
  onLogin,
  isLoginPending,
  recoveryLink,
}: WelcomeSheetProps) {
  const insets = useSafeAreaInsets();
  const progress = useSharedValue(0);
  // Measured height of the card; drives how far it translates when hidden so it
  // is always fully off-screen regardless of content (e.g. recovery link).
  const travel = useSharedValue(DEFAULT_TRAVEL);

  useEffect(() => {
    progress.value = withTiming(visible ? 1 : 0, { duration: 260 });
  }, [visible, progress]);

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
  }));

  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: (1 - progress.value) * travel.value }],
  }));

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents={visible ? 'auto' : 'none'}>
      {/* Scrim — tap to dismiss */}
      <Animated.View style={[StyleSheet.absoluteFill, backdropStyle]}>
        <Pressable style={styles.scrim} onPress={onClose} />
      </Animated.View>

      {/* Floating card */}
      <Animated.View
        style={[styles.card, { bottom: insets.bottom + 8 }, cardStyle]}
        onLayout={e => {
          const h = e.nativeEvent.layout.height;
          if (h > 0) {
            // Height + bottom offset + buffer so it clears the screen fully.
            travel.value = h + insets.bottom + 40;
          }
        }}
      >
        {/* Drag handle */}
        <Pressable onPress={onClose} className="items-center pt-[17px]">
          <View className="h-[5px] w-[73px] rounded-full bg-white/20" />
        </Pressable>

        <Text className="mt-[47px] text-center text-[30px] font-medium -tracking-[1px] text-white">
          Welcome
        </Text>

        <Button
          variant="brand"
          className="mt-[56px] h-[50px] w-full rounded-full active:opacity-90"
          onPress={onCreateAccount}
        >
          <Text className="text-base font-semibold text-black">Create account</Text>
        </Button>

        {/* OR divider */}
        <View className="my-[24px] flex-row items-center gap-4">
          <View className="h-[1px] flex-1 bg-white/10" />
          <Text className="text-sm text-white/50">OR</Text>
          <View className="h-[1px] flex-1 bg-white/10" />
        </View>

        <Button
          variant="secondary"
          className="h-[50px] w-full rounded-full border-0 bg-white active:opacity-90"
          onPress={onLogin}
          disabled={isLoginPending}
        >
          {isLoginPending ? (
            <View className="flex-row items-center">
              <ActivityIndicator size="small" color="#000" />
              <Text className="ml-2 text-base font-semibold text-black">Authenticating...</Text>
            </View>
          ) : (
            <Text className="text-base font-semibold text-black">Log in</Text>
          )}
        </Button>

        {/* Account recovery prompt — only after a failed login */}
        {recoveryLink ? <View className="mt-4">{recoveryLink}</View> : null}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  card: {
    position: 'absolute',
    left: 8,
    right: 8,
    // `bottom` is set inline from safe-area insets.
    paddingHorizontal: 20,
    paddingBottom: 40,
    borderRadius: 40,
    backgroundColor: '#1c1c1c',
    overflow: 'hidden',
  },
});
