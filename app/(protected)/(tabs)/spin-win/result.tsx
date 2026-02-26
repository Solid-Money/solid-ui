import { useEffect, useState } from 'react';
import { Platform, Pressable, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';

import ConfettiOverlay from '@/components/SpinAndWin/ConfettiOverlay';
import { Text } from '@/components/ui/text';
import { path } from '@/constants/path';
import { SPIN_WIN } from '@/constants/spinWinDesign';

export default function ResultScreen() {
  const { points } = useLocalSearchParams<{ points: string }>();
  const pointsValue = parseInt(points ?? '0', 10);
  const [showConfetti, setShowConfetti] = useState(false);

  const scale = useSharedValue(0);
  const opacity = useSharedValue(0);

  useEffect(() => {
    // Entrance animation
    scale.value = withSequence(
      withTiming(1.3, { duration: 400, easing: Easing.out(Easing.back(2)) }),
      withTiming(1, { duration: 200 }),
    );
    opacity.value = withTiming(1, { duration: 300 });

    // Trigger confetti after a short delay
    const confettiTimer = setTimeout(() => {
      setShowConfetti(true);
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    }, 300);

    return () => clearTimeout(confettiTimer);
  }, [scale, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <View style={{ flex: 1, backgroundColor: SPIN_WIN.colors.background }}>
      <ConfettiOverlay visible={showConfetti} />

      {/* Center content */}
      <View className="flex-1 items-center justify-center px-6">
        {/* Gold glow circle behind text (radial gradient SVG) */}
        <Image
          source={SPIN_WIN.result.glowSvgAsset}
          style={{
            position: 'absolute',
            width: SPIN_WIN.result.glowSize,
            height: SPIN_WIN.result.glowSize,
          }}
          contentFit="contain"
          pointerEvents="none"
        />

        <Animated.View style={[{ alignItems: 'center' }, animatedStyle]}>
          {/* Points value */}
          <Text
            style={{
              fontSize: SPIN_WIN.typography.hugeResult,
              fontWeight: '400',
              color: SPIN_WIN.colors.textPrimary,
              fontVariant: ['tabular-nums'],
              lineHeight: 120,
            }}
          >
            +{pointsValue.toLocaleString()}
          </Text>

          {/* Subtitle */}
          <Text
            style={{
              fontSize: SPIN_WIN.typography.subtitleSize,
              fontWeight: SPIN_WIN.typography.subtitleWeight,
              color: SPIN_WIN.result.subtitleColor,
              marginTop: 8,
            }}
          >
            Points earned
          </Text>
        </Animated.View>
      </View>

      {/* Continue button */}
      <View className="items-center px-6 pb-28">
        <Pressable
          onPress={() => router.push(path.SPIN_WIN_SUMMARY)}
          style={{ width: '100%', maxWidth: 388 }}
        >
          <View
            style={{
              backgroundColor: SPIN_WIN.colors.gold,
              borderRadius: SPIN_WIN.borderRadius.button,
              borderCurve: 'continuous',
              paddingVertical: 15,
              alignItems: 'center',
            }}
          >
            <Text
              style={{
                fontSize: SPIN_WIN.typography.ctaSize,
                fontWeight: SPIN_WIN.typography.ctaWeight,
                color: '#000000',
              }}
            >
              Continue
            </Text>
          </View>
        </Pressable>
      </View>
    </View>
  );
}
