import { useCallback, useState } from 'react';
import { Platform, Pressable, TouchableOpacity, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { router, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import SpinWheelCarousel from '@/components/SpinAndWin/SpinWheelCarousel';
import { Text } from '@/components/ui/text';
import { path } from '@/constants/path';
import { SPIN_WIN } from '@/constants/spinWinDesign';
import { usePerformSpin } from '@/hooks/useSpinWin';

export default function WheelScreen() {
  const [isSpinning, setIsSpinning] = useState(false);
  const [resultPoints, setResultPoints] = useState<number | undefined>();
  const [spinError, setSpinError] = useState<string | null>(null);
  const { mutateAsync: spin } = usePerformSpin();

  const handleTapToSpin = async () => {
    if (isSpinning) return;

    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    }

    setIsSpinning(true);
    setSpinError(null);

    try {
      const result = await spin();
      if (result) {
        setResultPoints(result.pointsEarned);
      }
    } catch (_error) {
      setIsSpinning(false);
      setSpinError('Failed to spin. Please try again.');
    }
  };

  const handleSpinComplete = useCallback((points: number) => {
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }

    setIsSpinning(false);
    setResultPoints(undefined);

    setTimeout(() => {
      router.push(`${path.SPIN_WIN_RESULT}?points=${points}` as never);
    }, 500);
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: SPIN_WIN.colors.background }}>
      <Stack.Screen
        options={{
          title: 'Spin & Win',
          headerShadowVisible: false,
          headerLeft: () => (
            <TouchableOpacity
              onPress={() => router.back()}
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: 'rgba(255, 255, 255, 0.08)',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="chevron-back" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          ),
          headerRight: () => (
            <TouchableOpacity
              onPress={() => router.navigate(path.SPIN_WIN as never)}
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: 'rgba(255, 255, 255, 0.08)',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="close" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          ),
        }}
      />

      {/* Carousel */}
      <View className="items-center" style={{ flex: 3 }}>
        <SpinWheelCarousel
          onSpinComplete={handleSpinComplete}
          isSpinning={isSpinning}
          resultPoints={resultPoints}
        />
      </View>

      {/* Subtitle + button — pushed to bottom with flex spacer */}
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <View className="items-center pb-4" style={{ gap: 4 }}>
          <Text
            style={{
              fontSize: SPIN_WIN.typography.subtitleSize,
              fontWeight: SPIN_WIN.typography.subtitleWeight,
              color: SPIN_WIN.colors.goldTransparent,
            }}
          >
            Spin to get daily points
          </Text>
        </View>

        {/* Error message */}
        {spinError && (
          <View className="items-center px-6 pb-4">
            <Text
              style={{
                fontSize: 14,
                color: SPIN_WIN.colors.goldTransparent,
              }}
            >
              {spinError}
            </Text>
          </View>
        )}

        {/* Spin button — extra bottom padding to clear the absolute-positioned tab bar */}
        <View className="items-center px-6 pb-28">
          <Pressable
            onPress={handleTapToSpin}
            disabled={isSpinning}
            style={{ width: '100%', maxWidth: 388 }}
          >
            <View
              style={{
                backgroundColor: isSpinning ? SPIN_WIN.colors.ctaDisabledBg : SPIN_WIN.colors.gold,
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
                  color: isSpinning ? SPIN_WIN.colors.ctaDisabledText : '#000000',
                }}
              >
                {isSpinning ? 'Spinning...' : 'Tap to spin'}
              </Text>
            </View>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
