import { type ComponentProps, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { BottomSheetBackdrop, BottomSheetModal, BottomSheetView } from '@gorhom/bottom-sheet';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { registerForPushNotificationsAsync } from '@/lib/registerForPushNotifications';

const FIGMA_SHEET_HEIGHT = 462;
const MOTION_DURATION_MS = 2200;

const bellAsset = require('@/assets/images/notification-drawer-bell.svg');
const badgeAsset = require('@/assets/images/notification-drawer-badge.svg');
const largeRingAsset = require('@/assets/images/notification-drawer-ring-large.svg');
const smallRingAsset = require('@/assets/images/notification-drawer-ring-small.svg');

interface NotificationPermissionSheetProps {
  visible: boolean;
  onDismiss: () => void;
}

/**
 * Figma's notification artwork is a coordinated 2.2s loop: the whole mark
 * fades/scales in, the bell rings, the motion strokes appear, then the badge
 * pops in. A single progress clock keeps every exported asset in sync.
 */
function NotificationBellAnimation({ running }: { running: boolean }) {
  const progress = useSharedValue(0);

  useEffect(() => {
    cancelAnimation(progress);
    progress.value = 0;

    if (running) {
      progress.value = withRepeat(
        withTiming(1, { duration: MOTION_DURATION_MS, easing: Easing.linear }),
        -1,
        false,
      );
    }

    return () => cancelAnimation(progress);
  }, [progress, running]);

  const groupStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.0364, 0.2818, 1], [0, 0, 1, 1], Extrapolation.CLAMP),
    transform: [
      {
        scale: interpolate(
          progress.value,
          [0, 0.0364, 0.38, 0.4318, 1],
          [0.92, 0.92, 1.003, 1, 1],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));

  const bellStyle = useAnimatedStyle(() => {
    const times = [0, 0.25, 0.3182, 0.4, 0.4727, 0.5364, 0.6, 0.6636, 1];

    return {
      transform: [
        {
          translateX: interpolate(
            progress.value,
            times,
            [0, 0, -7.1, 5.34, -3.27, 1.79, -0.72, 0, 0],
            Extrapolation.CLAMP,
          ),
        },
        {
          translateY: interpolate(
            progress.value,
            times,
            [0, 0, -0.75, -0.42, -0.16, -0.05, -0.01, 0, 0],
            Extrapolation.CLAMP,
          ),
        },
        {
          rotate: `${interpolate(
            progress.value,
            times,
            [0, 0, 12, -9, 5.5, -3, 1.2, 0, 0],
            Extrapolation.CLAMP,
          )}deg`,
        },
      ],
    };
  });

  const largeRingStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.2909, 0.4, 1], [0, 0, 1, 1], Extrapolation.CLAMP),
  }));

  const smallRingStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.3136, 0.4227, 1], [0, 0, 1, 1], Extrapolation.CLAMP),
  }));

  const badgeStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.4818, 0.5727, 1], [0, 0, 1, 1], Extrapolation.CLAMP),
    transform: [
      {
        scale: interpolate(
          progress.value,
          [0, 0.4818, 0.54, 0.59, 0.63, 0.67, 0.6909, 1],
          [0.3, 0.3, 0.75, 1.05, 1.068, 1.02, 1, 1],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));

  return (
    <Animated.View accessible={false} style={[styles.artworkStage, groupStyle]}>
      <Animated.View style={[styles.bell, bellStyle]}>
        <Image source={bellAsset} style={styles.fill} contentFit="fill" />
      </Animated.View>

      <Animated.View style={[styles.largeRing, largeRingStyle]}>
        <Image source={largeRingAsset} style={styles.fill} contentFit="fill" />
      </Animated.View>

      <Animated.View style={[styles.smallRing, smallRingStyle]}>
        <Image source={smallRingAsset} style={styles.fill} contentFit="fill" />
      </Animated.View>

      <Animated.View style={[styles.badge, badgeStyle]}>
        <Image source={badgeAsset} style={styles.fill} contentFit="fill" />
        <Text style={styles.badgeNumber}>1</Text>
      </Animated.View>
    </Animated.View>
  );
}

/** Notification onboarding presented over the real wallet screen. */
export default function NotificationPermissionSheet({
  visible,
  onDismiss,
}: NotificationPermissionSheetProps) {
  const sheetRef = useRef<BottomSheetModal>(null);
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [isLoading, setIsLoading] = useState(false);
  const sheetHeight = Math.min(FIGMA_SHEET_HEIGHT, height - insets.top - 8);
  const snapPoints = useMemo(() => [sheetHeight], [sheetHeight]);

  useEffect(() => {
    if (visible) {
      sheetRef.current?.present();
    } else {
      sheetRef.current?.dismiss();
    }
  }, [visible]);

  const handleContinue = useCallback(async () => {
    setIsLoading(true);

    try {
      await registerForPushNotificationsAsync();
    } catch (error) {
      console.error('Notification registration failed:', error);
    } finally {
      setIsLoading(false);
      sheetRef.current?.dismiss();
    }
  }, []);

  const renderBackdrop = useCallback(
    (props: ComponentProps<typeof BottomSheetBackdrop>) => (
      <BottomSheetBackdrop
        {...props}
        opacity={0.8}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        pressBehavior="close"
      />
    ),
    [],
  );

  return (
    <BottomSheetModal
      ref={sheetRef}
      snapPoints={snapPoints}
      enableDynamicSizing={false}
      enablePanDownToClose
      backdropComponent={renderBackdrop}
      backgroundStyle={styles.sheetBackground}
      handleComponent={null}
      onDismiss={onDismiss}
    >
      <BottomSheetView style={[styles.sheet, { height: sheetHeight }]}>
        <View style={styles.handle} />

        <NotificationBellAnimation running={visible} />

        <Text style={styles.title}>Turn on notifications</Text>
        <Text style={styles.description}>
          Get instant alerts for card payments, deposits, and rewards. You control what you receive
          in Settings.
        </Text>

        <Button
          variant="brand"
          size="sm"
          className="absolute left-[34px] right-[33px] h-12 rounded-full px-0 active:opacity-90"
          style={{ bottom: Math.max(34, insets.bottom) }}
          onPress={handleContinue}
          disabled={isLoading}
        >
          <Text style={styles.buttonLabel}>{isLoading ? 'Loading...' : 'Continue'}</Text>
        </Button>
      </BottomSheetView>
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  sheetBackground: {
    backgroundColor: '#1c1c1c',
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
  },
  sheet: {
    overflow: 'hidden',
  },
  handle: {
    position: 'absolute',
    top: 18,
    left: '50%',
    width: 73,
    height: 5,
    marginLeft: -36.5,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  artworkStage: {
    position: 'absolute',
    top: 86,
    left: '50%',
    width: 96,
    height: 90,
    marginLeft: -48,
  },
  fill: {
    width: '100%',
    height: '100%',
  },
  bell: {
    position: 'absolute',
    top: 0,
    left: 18,
    width: 70,
    height: 70,
  },
  largeRing: {
    position: 'absolute',
    top: 57,
    left: 49,
    width: 29.336,
    height: 23.238,
    transform: [{ rotate: '-15deg' }],
  },
  smallRing: {
    position: 'absolute',
    top: 59,
    left: 27,
    width: 25.309,
    height: 21.377,
    transform: [{ rotate: '63.71deg' }],
  },
  badge: {
    position: 'absolute',
    top: -2,
    left: 3,
    width: 51,
    height: 51,
  },
  badgeNumber: {
    position: 'absolute',
    top: 6,
    left: 8,
    width: 35,
    height: 35,
    color: '#ffffff',
    fontFamily: 'MonaSans_300Light',
    fontSize: 26,
    fontWeight: '300',
    lineHeight: 35,
    letterSpacing: -2,
    textAlign: 'center',
  },
  title: {
    position: 'absolute',
    top: 203,
    left: '50%',
    width: 331,
    marginLeft: -165.5,
    color: '#ffffff',
    fontFamily: 'MonaSans_500Medium',
    fontSize: 30,
    fontWeight: '500',
    lineHeight: 36,
    letterSpacing: -1,
    textAlign: 'center',
  },
  description: {
    position: 'absolute',
    top: 260,
    left: '50%',
    width: 316,
    marginLeft: -158,
    color: 'rgba(255, 255, 255, 0.6)',
    fontFamily: 'MonaSans_400Regular',
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 19.2,
    textAlign: 'center',
  },
  buttonLabel: {
    color: '#000000',
    fontFamily: 'MonaSans_700Bold',
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 20,
    textAlign: 'center',
  },
});
